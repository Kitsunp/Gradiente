document.addEventListener('DOMContentLoaded', () => {
    // --- Objeto para gestionar las animaciones ---
    const gradientAnimations = {};
    // --- Estado Global ---
    let activeAnimationId = null; // ID del capítulo cuya animación está activa

    // --- Constantes y Configuraciones Comunes ---
    const commonConfig = {
        scale: 50,
        precision: 0.0001, // Mayor precisión para convergencia
        maxHistory: 150, // Más historial
        vectorScaleFactor: 2000,
        maxVectorLen: 35,
        defaultLR: 0.1,
        axesColor: '#ccc',
        funcColor: '#3498db',
        pointColor: '#e74c3c',
        historyColor: 'rgba(230, 126, 34, 0.7)',
        vectorColor: '#2ecc71',
        maxIterations: 1000 // Aumentado
    };

    // --- Funciones de Utilidad ---
    function worldToCanvas(x, y, config) {
        return {
            x: config.offsetX + x * config.scale,
            y: config.offsetY - y * config.scale
        };
    }

    function canvasToWorldX(canvasX, config) {
        return (canvasX - config.offsetX) / config.scale;
    }

    function getRandomStartX(min = -5, max = 5, avoidZone = 0.5) {
        let start = min + Math.random() * (max - min);
        return Math.abs(start) < avoidZone ? (start < 0 ? -avoidZone : avoidZone) : start;
    }

    // --- Funciones de Dibujo Comunes ---
    function drawAxes(ctx, config) {
        ctx.save(); // Guardar estado del contexto
        ctx.strokeStyle = config.axesColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, config.offsetY); ctx.lineTo(config.canvas.width, config.offsetY); // X axis
        ctx.moveTo(config.offsetX, 0); ctx.lineTo(config.offsetX, config.canvas.height); // Y axis
        // Add ticks and labels (optional improvement)
        ctx.font = '10px Arial';
        ctx.fillStyle = '#999';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        const xRange = config.canvas.width / config.scale;
        for (let x = Math.ceil(-xRange/2); x <= Math.floor(xRange/2); x++) {
            if (x === 0) continue;
            const canvasX = config.offsetX + x * config.scale;
            ctx.moveTo(canvasX, config.offsetY - 3);
            ctx.lineTo(canvasX, config.offsetY + 3);
            ctx.fillText(x.toString(), canvasX, config.offsetY + 5);
        }
        // Similar ticks for Y axis could be added
        ctx.stroke();
        ctx.restore(); // Restaurar estado
    }

    function drawFunctionCurve(ctx, config, objectiveFunc) {
         ctx.save();
        ctx.strokeStyle = config.funcColor;
        ctx.lineWidth = 2.5; // Slightly thicker line
        ctx.beginPath();
        let firstPoint = true;
        const minX = canvasToWorldX(0, config);
        const maxX = canvasToWorldX(config.canvas.width, config);
        const step = (maxX - minX) / config.canvas.width; // Step per pixel

        for (let plotX = minX; plotX <= maxX; plotX += step) {
            const worldY = objectiveFunc(plotX);
            // Simple clipping to avoid extreme values messing up the plot
            const canvasY = config.offsetY - worldY * config.scale;
             if (canvasY < -config.canvas.height || canvasY > config.canvas.height * 2) { // Generous bounds
                 // If previous point was valid, end the line segment
                 if (!firstPoint) ctx.stroke();
                 firstPoint = true; // Treat next valid point as start of new segment
                 continue;
            }

            const canvasX = config.offsetX + plotX * config.scale;
            if (firstPoint) {
                ctx.moveTo(canvasX, canvasY);
                firstPoint = false;
            } else {
                ctx.lineTo(canvasX, canvasY);
            }
        }
        ctx.stroke();
        ctx.restore();
    }

     function drawHistory(ctx, config, historyPoints) {
        ctx.save();
        for (let i = 0; i < historyPoints.length; i++) {
            const point = historyPoints[i];
            const alpha = 0.1 + 0.7 * (i / historyPoints.length);
            const colorMatch = config.historyColor.match(/rgba?\((\d+), (\d+), (\d+)(?:, ([\d\.]+))?\)/);
            if (colorMatch) {
                 ctx.fillStyle = `rgba(${colorMatch[1]}, ${colorMatch[2]}, ${colorMatch[3]}, ${alpha})`;
            } else {
                 ctx.fillStyle = config.historyColor;
            }
            ctx.beginPath();
            ctx.arc(point.x, point.y, 3, 0, Math.PI * 2); // Slightly larger history points
            ctx.fill();
        }
        ctx.restore();
    }

    function drawCurrentPointAndVector(ctx, config, currentX, currentY, gradX, learningRate) {
        ctx.save();
        const canvasPos = worldToCanvas(currentX, currentY, config);

        // Draw Point
        ctx.fillStyle = config.pointColor;
        ctx.beginPath();
        ctx.arc(canvasPos.x, canvasPos.y, 7, 0, Math.PI * 2); // Larger point
        ctx.fill();
        ctx.strokeStyle = '#a5281b'; // Darker red border
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Draw Descent Vector
        const descentDirX = -gradX;
        let stepSize = descentDirX * learningRate;
        let vectorLen = Math.abs(stepSize * config.vectorScaleFactor);
        vectorLen = Math.min(vectorLen, config.maxVectorLen);

        if (vectorLen > 1) {
            const angle = stepSize > 0 ? 0 : Math.PI;
            ctx.strokeStyle = config.vectorColor;
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.moveTo(canvasPos.x, canvasPos.y);
            const endX = canvasPos.x + vectorLen * Math.cos(angle);
            const endY = canvasPos.y;
            ctx.lineTo(endX, endY);
            // Arrowhead
            const arrowSize = 6;
            ctx.lineTo(endX - arrowSize * Math.cos(angle - Math.PI / 6), endY - arrowSize * Math.sin(angle - Math.PI / 6));
            ctx.moveTo(endX, endY);
            ctx.lineTo(endX - arrowSize * Math.cos(angle + Math.PI / 6), endY - arrowSize * Math.sin(angle + Math.PI / 6));
            ctx.stroke();
        }
        ctx.restore();
    }

    // --- Base Animation Class/Factory ---
    function createBaseAnimation(chapterId, customConfig = {}) {
        const canvas = document.getElementById(`canvas-${chapterId}`);
        const controlsDiv = document.getElementById(`controls-${chapterId}`);
        const lrSlider = controlsDiv.querySelector('input[id^="lrSlider-"]');
        const lrDisplay = controlsDiv.querySelector('.lrDisplay');
        const infoText = controlsDiv.querySelector('.infoText');

        if (!canvas || !lrSlider) {
            console.error(`Elementos no encontrados para el capítulo ${chapterId}`);
            return null;
        }

        const ctx = canvas.getContext('2d');
        const config = {
            ...commonConfig,
            canvas: canvas,
            ctx: ctx,
            offsetX: canvas.width / 2,
            offsetY: canvas.height * 0.85, // Default, can be overridden
            targetX: 0, // Default, can be overridden
            objectiveFunction: x => x * x, // Default
            gradientFunction: x => 2 * x, // Default
            ...customConfig // Override defaults with chapter-specific settings
        };

        let state = {
            currentX: getRandomStartX(config.startXMin ?? -4, config.startXMax ?? 4, 0.5),
            learningRate: parseFloat(lrSlider.value),
            historyPoints: [],
            animationFrameId: null,
            iteration: 0,
            noiseLevel: 0, // For SGD
            isRunning: false
        };

        // Specific sliders for SGD and Challenges
        const noiseSlider = controlsDiv.querySelector('input[id^="noiseSlider-"]');
        const noiseDisplay = controlsDiv.querySelector('.noiseDisplay');
        if (noiseSlider && noiseDisplay) {
            state.noiseLevel = parseFloat(noiseSlider.value);
            noiseSlider.addEventListener('input', () => {
                 state.noiseLevel = parseFloat(noiseSlider.value);
                 noiseDisplay.textContent = state.noiseLevel.toFixed(1);
                 if (!state.isRunning) draw(); // Update display if not running
            });
        }


        function draw() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            drawAxes(ctx, config);
            drawFunctionCurve(ctx, config, config.objectiveFunction);
            drawHistory(ctx, config, state.historyPoints);
            const currentY = config.objectiveFunction(state.currentX);
            const gradX = config.gradientFunction(state.currentX);
            drawCurrentPointAndVector(ctx, config, state.currentX, currentY, gradX, state.learningRate);

            // Update info text
            let status = state.isRunning ? `Iter: ${state.iteration}` : "Pausado";
             let noiseInfo = noiseSlider ? `, Ruido: ${state.noiseLevel.toFixed(1)}` : "";
             infoText.textContent = `${status}, x=${state.currentX.toFixed(3)}, f(x)=${currentY.toFixed(3)}, ∇f(x)=${gradX.toFixed(3)}, η=${state.learningRate.toFixed(3)}${noiseInfo}`;
        }

        function update() {
            if (!state.isRunning) return; // Exit if stopped externally

            let gradX = config.gradientFunction(state.currentX);
            const previousX = state.currentX;

            // Add noise for SGD
            if (chapterId === 'sgd' && state.noiseLevel > 0) {
                 // Noise proportional to gradient magnitude can feel more natural
                 const noise = (Math.random() - 0.5) * 2 * state.noiseLevel * (Math.abs(gradX) + 0.1); // Add small base noise
                 gradX += noise;
            }

            // Store history (canvas coords)
            const currentY = config.objectiveFunction(state.currentX);
            const canvasPos = worldToCanvas(state.currentX, currentY, config);
            state.historyPoints.push({ x: canvasPos.x, y: canvasPos.y });
            if (state.historyPoints.length > config.maxHistory) {
                state.historyPoints.shift();
            }

            // Update position
            state.currentX = state.currentX - state.learningRate * gradX;
            state.iteration++;

            draw(); // Redraw

            // Stopping condition
            const change = Math.abs(state.currentX - previousX);
            // Check for NaN or Infinity
             if (isNaN(state.currentX) || !isFinite(state.currentX)) {
                 console.warn(`${chapterId}: Divergencia detectada (valor no numérico)`);
                 infoText.textContent = `¡Divergencia! Valor de x no válido en iter ${state.iteration}. Prueba η más pequeña.`;
                 stop();
                 return;
             }
            // Check max iterations or precision
             if (state.iteration >= config.maxIterations || change < config.precision) {
                 const reason = (state.iteration >= config.maxIterations ? "Max iteraciones" : "Convergencia");
                 console.log(`${chapterId}: ${reason} en x = ${state.currentX.toFixed(4)} (cambio: ${change.toExponential(2)})`);
                 infoText.textContent = `${reason}! x ≈ ${state.currentX.toFixed(3)} en ${state.iteration} iter.`;
                 stop(); // Stop animation but keep final state drawn
                 return;
             }

            state.animationFrameId = requestAnimationFrame(update);
        }

        function start(startX = null) {
            stop(); // Ensure any previous run is stopped
            state.isRunning = true;
            state.currentX = (startX !== null && isFinite(startX)) ? startX : getRandomStartX(config.startXMin ?? -4, config.startXMax ?? 4, 0.5);
            state.historyPoints = [];
            state.iteration = 0;
            state.learningRate = parseFloat(lrSlider.value);
            lrDisplay.textContent = state.learningRate.toFixed(3);
             if (noiseSlider) state.noiseLevel = parseFloat(noiseSlider.value); // Ensure noise level is current

            console.log(`${chapterId}: Iniciando desde x = ${state.currentX.toFixed(3)}, LR = ${state.learningRate}${noiseSlider ? ', Ruido = '+state.noiseLevel : ''}`);
            infoText.textContent = `Iniciando desde x ≈ ${state.currentX.toFixed(2)}...`;

            draw(); // Draw initial state
            state.animationFrameId = requestAnimationFrame(update);
            activeAnimationId = chapterId; // Mark this as the active animation
        }

        function stop() {
            state.isRunning = false;
            if (state.animationFrameId) {
                cancelAnimationFrame(state.animationFrameId);
                state.animationFrameId = null;
            }
            if (activeAnimationId === chapterId) {
                activeAnimationId = null;
            }
            // Do not clear the final state, just stop the loop
            // Optionally update info text to 'Pausado' or similar
            // draw(); // Redraw in stopped state if needed
        }

        // --- Event Listeners Specific to this Instance ---
        lrSlider.addEventListener('input', () => {
            state.learningRate = parseFloat(lrSlider.value);
            lrDisplay.textContent = state.learningRate.toFixed(3);
            if (!state.isRunning) {
                 draw(); // Update static drawing if LR changes while paused
                 infoText.textContent = `Ajustado η = ${state.learningRate.toFixed(3)}. Haz clic para iniciar.`;
            }
        });

        canvas.addEventListener('click', (event) => {
             if (activeAnimationId && activeAnimationId !== chapterId) {
                 gradientAnimations[activeAnimationId]?.stop(); // Stop other active animation
             }
             const rect = canvas.getBoundingClientRect();
             const canvasX = event.clientX - rect.left;
             const clickedWorldX = canvasToWorldX(canvasX, config);
             // Simple check to avoid starting at extreme values if function shoots off
             if(isFinite(clickedWorldX)) {
                start(clickedWorldX);
             }
        });

        // Public interface for this animation instance
        return {
            start,
            stop,
            draw, // Expose draw for initial static render
            config, // Expose config if needed elsewhere
            state // Expose state if needed elsewhere (use with caution)
        };
    }

    // --- Initialize Animations for Relevant Chapters ---
    const chaptersToAnimate = {
        'batch-gd': {}, // Uses defaults
        'learning-rate': { targetX: 0 }, // Specify target just in case
        'sgd': { // Needs noise slider logic (handled inside base class now)
             targetX: 0
         },
        'challenges': {
            // Function: f(x) = 0.1x^4 - 1.5x^2 + 0.5x + 4
            // Derivative: f'(x) = 0.4x^3 - 3x + 0.5
            objectiveFunction: x => 0.1 * Math.pow(x, 4) - 1.5 * Math.pow(x, 2) + 0.5 * x + 4,
            gradientFunction: x => 0.4 * Math.pow(x, 3) - 3 * x + 0.5,
            offsetY: 350, // Adjust Y offset to center the function vertically
            scale: 45,     // Adjust scale to fit the function horizontally/vertically
            startXMin: -4.5, // Wider start range
            startXMax: 4.5,
            targetX: null // No single target X for this function
        }
    };

    document.querySelectorAll('.start-animation-btn').forEach(button => {
        const chapterId = button.dataset.chapter;
        if (chapterId && chaptersToAnimate[chapterId]) {
            gradientAnimations[chapterId] = createBaseAnimation(chapterId, chaptersToAnimate[chapterId]);
            if (gradientAnimations[chapterId]) {
                gradientAnimations[chapterId].draw(); // Draw initial static frame
            } else {
                 console.error(`Fallo al inicializar la animación para ${chapterId}`);
            }

            button.addEventListener('click', () => {
                 if (activeAnimationId && activeAnimationId !== chapterId) {
                     gradientAnimations[activeAnimationId]?.stop();
                 }
                 gradientAnimations[chapterId]?.start();
            });
        }
    });

    // Stop animation if user navigates away
    window.addEventListener('beforeunload', () => {
        if (activeAnimationId && gradientAnimations[activeAnimationId]) {
            gradientAnimations[activeAnimationId].stop();
        }
    });

    console.log("Guía Interactiva de Descenso de Gradiente Inicializada. Animaciones disponibles:", Object.keys(gradientAnimations));

}); // End DOMContentLoaded