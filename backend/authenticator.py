import mediapipe as mp
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision
import cv2
import asyncio
import os
import base64
import numpy as np
import urllib.request
import sys
from collections import deque

class FaceAuthenticator:
    # MediaPipe Face Landmarker model URL
    MODEL_URL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task"
    MODEL_PATH = os.path.join(os.path.dirname(__file__), "face_landmarker.task")

    NOSE_TIP_IDX = 1
    
    def __init__(self, reference_image_path="reference.jpg", on_status_change=None, on_frame=None):
        """
        :param reference_image_path: Path to the user's reference photo.
        :param on_status_change: Async callback(is_authenticated: bool).
        :param on_frame: Async callback(frame_data_b64: str) to send frames to frontend.
        """
        self.reference_image_path = reference_image_path
        self.on_status_change = on_status_change
        self.on_frame = on_frame
        
        self.authenticated = False
        self.running = False
        self.reference_landmarks = None
        self.landmarker = None

        self._reset_security_state()

        self._ensure_model()
        self._init_landmarker()
        self._load_reference()

    def _ensure_model(self):
        """Download the MediaPipe Face Landmarker model if not present."""
        if not os.path.exists(self.MODEL_PATH):
            print(f"[AUTH] Downloading Face Landmarker model...")
            try:
                urllib.request.urlretrieve(self.MODEL_URL, self.MODEL_PATH)
                print(f"[AUTH] [OK] Model downloaded to {self.MODEL_PATH}")
            except Exception as e:
                print(f"[AUTH] [ERR] Failed to download model: {e}")

    def _init_landmarker(self):
        """Initialize the MediaPipe Face Landmarker."""
        if not os.path.exists(self.MODEL_PATH):
            print("[AUTH] [ERR] Face Landmarker model not found. Cannot initialize.")
            return
        
        try:
            base_options = mp_python.BaseOptions(model_asset_path=self.MODEL_PATH)
            options = vision.FaceLandmarkerOptions(
                base_options=base_options,
                output_face_blendshapes=False,
                output_facial_transformation_matrixes=False,
                num_faces=1
            )
            self.landmarker = vision.FaceLandmarker.create_from_options(options)
            print("[AUTH] [OK] Face Landmarker initialized.")
        except Exception as e:
            print(f"[AUTH] [ERR] Failed to initialize Face Landmarker: {e}")

    def _extract_landmark_points(self, image_rgb):
        """
        Extract normalized face landmarks from an RGB image.
        Returns numpy array with shape (N, 3), or None if no face found.
        """
        if self.landmarker is None:
            return None
        
        try:
            mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=image_rgb)
            result = self.landmarker.detect(mp_image)
            
            if result.face_landmarks and len(result.face_landmarks) > 0:
                landmarks = result.face_landmarks[0]
                coords = np.array([[lm.x, lm.y, lm.z] for lm in landmarks], dtype=np.float32)
                return coords
            return None
        except Exception as e:
            print(f"[AUTH] [ERR] Landmark extraction failed: {e}")
            return None

    def _extract_landmarks(self, image_rgb):
        points = self._extract_landmark_points(image_rgb)
        if points is None:
            return None
        return self._normalized_landmark_vector(points)

    def _reset_security_state(self):
        self.similarity_history = deque(maxlen=12)
        self.nose_x_history = deque(maxlen=20)
        self.quality_frame_count = 0

    def _similarity_score(self, landmarks1, landmarks2):
        if landmarks1 is None or landmarks2 is None:
            return 0.0

        norm1 = np.linalg.norm(landmarks1)
        norm2 = np.linalg.norm(landmarks2)
        if norm1 == 0 or norm2 == 0:
            return 0.0

        return float(np.dot(landmarks1, landmarks2) / (norm1 * norm2))

    def _normalized_landmark_vector(self, points):
        # Normalize translation/scale to reduce distance and framing sensitivity.
        center = np.mean(points, axis=0)
        centered = points - center
        scale_xy = float(np.std(centered[:, :2]))
        if scale_xy < 1e-6:
            scale_xy = 1e-6
        centered[:, :2] = centered[:, :2] / scale_xy

        # Keep Z, but normalized by its own spread for pose-depth consistency.
        scale_z = float(np.std(centered[:, 2]))
        if scale_z < 1e-6:
            scale_z = 1e-6
        centered[:, 2] = centered[:, 2] / scale_z
        return centered.flatten()

    def _face_bbox_ratio(self, points):
        min_xy = np.min(points[:, :2], axis=0)
        max_xy = np.max(points[:, :2], axis=0)
        w = max(0.0, float(max_xy[0] - min_xy[0]))
        h = max(0.0, float(max_xy[1] - min_xy[1]))
        return w * h

    def _frame_sharpness(self, frame_bgr):
        gray = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2GRAY)
        return float(cv2.Laplacian(gray, cv2.CV_64F).var())

    def _distance_profile(self, face_ratio):
        # Profile by apparent face size in frame to keep verification stable at different distances.
        if face_ratio < 0.10:
            return {
                "name": "far",
                "face_ratio_min": 0.03,
                "face_ratio_max": 0.72,
                "sharpness_min": 20.0,
                "z_std_min": 0.002,
                "z_std_max": 0.12,
                "liveness_min_motion": 0.004,
                "liveness_max_motion": 0.09,
                "unlock_window": 7,
                "min_similarity_per_frame": 0.91,
                "avg_similarity_required": 0.945,
                "fast_unlock_window": 5,
                "fast_min_similarity": 0.97,
            }
        if face_ratio < 0.33:
            return {
                "name": "mid",
                "face_ratio_min": 0.03,
                "face_ratio_max": 0.72,
                "sharpness_min": 35.0,
                "z_std_min": 0.003,
                "z_std_max": 0.13,
                "liveness_min_motion": 0.006,
                "liveness_max_motion": 0.09,
                "unlock_window": 6,
                "min_similarity_per_frame": 0.91,
                "avg_similarity_required": 0.945,
                "fast_unlock_window": 4,
                "fast_min_similarity": 0.965,
            }
        return {
            "name": "near",
            "face_ratio_min": 0.03,
            "face_ratio_max": 0.80,
            "sharpness_min": 45.0,
            "z_std_min": 0.004,
            "z_std_max": 0.14,
            "liveness_min_motion": 0.008,
            "liveness_max_motion": 0.10,
            "unlock_window": 5,
            "min_similarity_per_frame": 0.90,
            "avg_similarity_required": 0.94,
            "fast_unlock_window": 4,
            "fast_min_similarity": 0.96,
        }

    def _passive_liveness_ok(self, points, profile):
        nose_x = float(points[self.NOSE_TIP_IDX][0])
        self.nose_x_history.append(nose_x)

        if len(self.nose_x_history) < 6:
            return False

        movement = max(self.nose_x_history) - min(self.nose_x_history)
        # Too static looks spoof-like, too large suggests unstable tracking.
        return profile["liveness_min_motion"] <= movement <= profile["liveness_max_motion"]

    def _compare_landmarks(self, landmarks1, landmarks2, threshold=0.15):
        """
        Compare two landmark vectors using cosine similarity.
        Returns True if similarity is above (1 - threshold).
        """
        if landmarks1 is None or landmarks2 is None:
            return False
        
        similarity = self._similarity_score(landmarks1, landmarks2)
        
        # Threshold check (similarity should be close to 1 for a match)
        is_match = similarity > (1 - threshold)
        if is_match:
            print(f"[AUTH] Face match! Similarity: {similarity:.4f}")
        return is_match

    def _load_reference(self):
        if not os.path.exists(self.reference_image_path):
            print(f"[AUTH] [WARN] Reference file not found at {self.reference_image_path}. Authentication will fail.")
            return

        try:
            print("[AUTH] Loading reference image...")
            img_bgr = cv2.imread(self.reference_image_path)
            if img_bgr is None:
                print(f"[AUTH] [ERR] Failed to read image file: {self.reference_image_path}")
                return
            
            # Convert to RGB
            image_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
            
            self.reference_landmarks = self._extract_landmarks(image_rgb)
            
            if self.reference_landmarks is not None:
                print("[AUTH] [OK] Reference face landmarks extracted successfully.")
            else:
                print("[AUTH] [ERR] No face found in reference image.")
        except Exception as e:
            print(f"[AUTH] [ERR] Error loading reference: {e}")

    async def start_authentication_loop(self):
        if self.authenticated:
            print("[AUTH] Already authenticated.")
            if self.on_status_change:
                await self.on_status_change(True)
            return

        if self.reference_landmarks is None:
             print("[AUTH] [ERR] Cannot start auth loop: No reference landmarks.")
             return

        self.running = True
        self._reset_security_state()
        print("[AUTH] Starting camera for authentication...")
        
        # Capture the current (main) event loop
        loop = asyncio.get_running_loop()
        
        # Use a separate thread for blocking camera/CV operations
        await asyncio.to_thread(self._run_cv_loop, loop)

        print("[AUTH] Authentication loop finished.")
    
    def stop(self):
        print("[AUTH] Stopping authentication loop...")
        self.running = False

    def _run_cv_loop(self, loop):
        def _backend_candidates():
            if sys.platform.startswith("win"):
                return [
                    ("CAP_DSHOW", getattr(cv2, "CAP_DSHOW", None)),
                    ("CAP_MSMF", getattr(cv2, "CAP_MSMF", None)),
                    ("CAP_ANY", getattr(cv2, "CAP_ANY", 0)),
                ]
            if sys.platform == "darwin":
                return [
                    ("CAP_AVFOUNDATION", getattr(cv2, "CAP_AVFOUNDATION", None)),
                    ("CAP_ANY", getattr(cv2, "CAP_ANY", 0)),
                ]
            return [
                ("CAP_V4L2", getattr(cv2, "CAP_V4L2", None)),
                ("CAP_ANY", getattr(cv2, "CAP_ANY", 0)),
            ]

        def try_open_camera(index):
            for backend_name, backend_id in _backend_candidates():
                if backend_id is None:
                    continue

                print(f"[AUTH] Trying camera index {index} with {backend_name}...")
                cap = cv2.VideoCapture(index, backend_id)
                if not cap.isOpened():
                    print(f"[AUTH] [WARN] Could not open index {index} with {backend_name}.")
                    cap.release()
                    continue

                # Warm up a couple of frames; some drivers return empty first frames.
                frame_ok = False
                for _ in range(6):
                    ret, _ = cap.read()
                    if ret:
                        frame_ok = True
                        break

                if not frame_ok:
                    print(f"[AUTH] [WARN] Opened index {index} with {backend_name} but no valid frame yet.")
                    cap.release()
                    continue

                print(f"[AUTH] [OK] Camera opened: index {index} via {backend_name}.")
                return cap

            return None

        video_capture = None
        for candidate_index in range(0, 7):
            video_capture = try_open_camera(candidate_index)
            if video_capture is not None:
                break

        if video_capture is None:
             print("[AUTH] [ERR] All camera attempts failed. Authentication cannot proceed.")
             self.running = False
             return

        while self.running and not self.authenticated:
            ret, frame = video_capture.read()
            if not ret:
                print("[AUTH] [ERR] Failed to read frame from camera loop.")
                break
            
            # Convert BGR to RGB
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            
            current_points = self._extract_landmark_points(rgb_frame)
            current_landmarks = None if current_points is None else self._normalized_landmark_vector(current_points)

            if current_points is None:
                self.similarity_history.clear()
            else:
                face_ratio = self._face_bbox_ratio(current_points)
                profile = self._distance_profile(face_ratio)
                sharpness = self._frame_sharpness(frame)
                z_std = float(np.std(current_points[:, 2]))

                # Quality gates to reject tiny, blurry, or implausible face geometry frames.
                quality_ok = (
                    profile["face_ratio_min"] <= face_ratio <= profile["face_ratio_max"]
                    and sharpness >= profile["sharpness_min"]
                    and profile["z_std_min"] <= z_std <= profile["z_std_max"]
                )

                if quality_ok:
                    self.quality_frame_count += 1
                    similarity = self._similarity_score(self.reference_landmarks, current_landmarks)
                    if similarity >= profile["min_similarity_per_frame"]:
                        self.similarity_history.append(similarity)
                    else:
                        self.similarity_history.clear()
                else:
                    self.similarity_history.clear()

                passive_liveness_ok = self._passive_liveness_ok(current_points, profile)
                fast_slice = list(self.similarity_history)[-profile["fast_unlock_window"]:]
                fast_unlock_ok = (
                    len(fast_slice) >= profile["fast_unlock_window"]
                    and min(fast_slice) >= profile["fast_min_similarity"]
                    and self.quality_frame_count >= profile["fast_unlock_window"]
                )

                secure_unlock_ok = False
                if len(self.similarity_history) >= profile["unlock_window"] and passive_liveness_ok:
                    avg_similarity = float(np.mean(self.similarity_history))
                    min_similarity = float(np.min(self.similarity_history))
                    secure_unlock_ok = (
                        avg_similarity >= profile["avg_similarity_required"]
                        and min_similarity >= profile["min_similarity_per_frame"]
                    )

                if fast_unlock_ok or secure_unlock_ok:
                    self.authenticated = True
                    avg_similarity = float(np.mean(self.similarity_history)) if self.similarity_history else 0.0
                    min_similarity = float(np.min(self.similarity_history)) if self.similarity_history else 0.0
                    print(
                        "[AUTH] [OPEN] FACE VERIFIED (fast/secure multi-frame). "
                        f"profile={profile['name']}, avg={avg_similarity:.4f}, min={min_similarity:.4f}, quality_frames={self.quality_frame_count}"
                    )
                    if self.on_status_change:
                        asyncio.run_coroutine_threadsafe(self.on_status_change(True), loop)
                    self.running = False
                    break

            # Send frame to frontend if callback exists
            if self.on_frame:
                small_frame = cv2.resize(frame, (0, 0), fx=0.5, fy=0.5)
                _, buffer = cv2.imencode('.jpg', small_frame)
                b64_str = base64.b64encode(buffer).decode('utf-8')
                
                asyncio.run_coroutine_threadsafe(self.on_frame(b64_str), loop)

        video_capture.release()
