import React, { useEffect, useRef } from 'react';

const TopAudioBar = ({ selectedMicId }) => {
    const canvasRef = useRef(null);
    const audioContextRef = useRef(null);
    const analyserRef = useRef(null);
    const sourceRef = useRef(null);
    const streamRef = useRef(null);
    const animationFrameRef = useRef(null);

    const stopCapture = () => {
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
        }

        if (sourceRef.current) {
            sourceRef.current.disconnect();
            sourceRef.current = null;
        }

        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }

        if (audioContextRef.current) {
            audioContextRef.current.close();
            audioContextRef.current = null;
        }

        analyserRef.current = null;
    };

    const drawBars = (dataArray) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const width = canvas.width;
        const height = canvas.height;
        ctx.clearRect(0, 0, width, height);

        const barWidth = 4;
        const gap = 2;
        const center = width / 2;
        const barsPerSide = Math.max(1, Math.floor((width / 2 - gap / 2) / (barWidth + gap)));

        for (let i = 0; i < barsPerSide; i++) {
            const value = dataArray[i % dataArray.length] || 0;
            const percent = value / 255;
            const barHeight = Math.max(2, percent * height);

            ctx.fillStyle = `rgba(34, 211, 238, ${0.2 + percent * 0.8})`;

            const offset = gap / 2 + i * (barWidth + gap);
            const rightX = center + offset;
            const leftX = center - offset - barWidth;
            const y = (height - barHeight) / 2;

            ctx.fillRect(rightX, y, barWidth, barHeight);
            ctx.fillRect(leftX, y, barWidth, barHeight);
        }
    };

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        let isCancelled = false;

        const startCapture = async () => {
            stopCapture();

            try {
                const constraints = selectedMicId
                    ? { audio: { deviceId: { exact: selectedMicId } } }
                    : { audio: true };

                const stream = await navigator.mediaDevices.getUserMedia(constraints);
                if (isCancelled) {
                    stream.getTracks().forEach(track => track.stop());
                    return;
                }

                streamRef.current = stream;
                audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
                analyserRef.current = audioContextRef.current.createAnalyser();
                analyserRef.current.fftSize = 64;
                sourceRef.current = audioContextRef.current.createMediaStreamSource(stream);
                sourceRef.current.connect(analyserRef.current);

                const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);

                const draw = () => {
                    if (!analyserRef.current) return;
                    analyserRef.current.getByteFrequencyData(dataArray);
                    drawBars(dataArray);
                    animationFrameRef.current = requestAnimationFrame(draw);
                };

                draw();
            } catch (err) {
                console.error('[TopAudioBar] microphone visualization failed:', err);
            }
        };

        startCapture();

        return () => {
            isCancelled = true;
            stopCapture();
        };
    }, [selectedMicId]);

    return (
        <canvas
            ref={canvasRef}
            width={300}
            height={40}
            className="opacity-80"
        />
    );
};

export default TopAudioBar;
