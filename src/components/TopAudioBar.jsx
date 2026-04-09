import React, { useEffect, useRef } from 'react';

const TopAudioBar = ({ audioData }) => {
    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        const draw = () => {
            const width = canvas.width;
            const height = canvas.height;
            ctx.clearRect(0, 0, width, height);

            const barWidth = 4;
            const gap = 2;
            const center = width / 2;
            const barsPerSide = Math.max(1, Math.floor((width / 2 - gap / 2) / (barWidth + gap)));

            for (let i = 0; i < barsPerSide; i++) {
                const value = audioData[i % audioData.length] || 0;
                const percent = value / 255;
                const barHeight = Math.max(2, percent * height);

                ctx.fillStyle = `rgba(34, 211, 238, ${0.2 + percent * 0.8})`; // Cyan with opacity

                const offset = gap / 2 + i * (barWidth + gap);
                const rightX = center + offset;
                const leftX = center - offset - barWidth;
                const y = (height - barHeight) / 2;

                // Right side
                ctx.fillRect(rightX, y, barWidth, barHeight);

                // Left side
                ctx.fillRect(leftX, y, barWidth, barHeight);
            }
        };

        requestAnimationFrame(draw);
    }, [audioData]);

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
