document.addEventListener('DOMContentLoaded', () => {
    // --- Objeto para gestionar las visualizaciones (animadas y estáticas) ---
    const gradientAnimations = {}; 
    // --- Estado Global ---
    let activeAnimationId = null; 

    // --- Constantes y Configuraciones Comunes ---
    const commonConfig = {
        // Visualización
        scale: 50,            
        baseScale: 50,        
        offsetX: 0,           
        offsetY: 0,           
        axesColor: '#ccc',
        funcColor: '#3498db',
        pointColor: '#e74c3c',
        historyColor: 'rgba(230, 126, 34, 0.7)',
        vectorColor: '#2ecc71',
        nextStepColor: 'rgba(75, 192, 192, 0.7)', 
        // Animación
        precision: 0.0001,
        maxHistory: 150,
        maxIterations: 1000,
        // Interacción
        panStep: 0.5,         
        zoomFactor: 1.2,      
        // Default functions
        objectiveFunction: x => x * x,
        gradientFunction: x => 2 * x,
        targetX: 0 
    };

    // --- Funciones de Utilidad ---
    function getRandomStartX(min = -5, max = 5, avoidZone = 0.5) {
        let start = min + Math.random() * (max - min);
        if (avoidZone > 0 && Math.abs(start) < avoidZone) {
            return start < 0 ? -avoidZone : avoidZone;
        }
        return start;
    }

    // --- Funciones de Dibujo Comunes ---
    function drawAxes(ctx, config) {
        ctx.save();
        ctx.strokeStyle = config.axesColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        const xAxisYPos = config.worldToCanvas(0, 0).y; 
        ctx.moveTo(0, xAxisYPos);
        ctx.lineTo(config.canvas.width, xAxisYPos);
        const yAxisXPos = config.worldToCanvas(0, 0).x; 
        ctx.moveTo(yAxisXPos, 0);
        ctx.lineTo(yAxisXPos, config.canvas.height);
        ctx.font = '10px Arial';
        ctx.fillStyle = '#888'; 
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        const worldXMin = config.canvasToWorldX(0);
        const worldXMax = config.canvasToWorldX(config.canvas.width);
        for (let x = Math.ceil(worldXMin); x <= Math.floor(worldXMax); x++) {
            if (x === 0 && Math.abs(worldXMin) < 0.1 && Math.abs(worldXMax) < 0.1) continue; 
            const tickCanvasPos = config.worldToCanvas(x, 0);
            ctx.moveTo(tickCanvasPos.x, xAxisYPos - 3);
            ctx.lineTo(tickCanvasPos.x, xAxisYPos + 3);
            if (x !== 0) ctx.fillText(x.toString(), tickCanvasPos.x, xAxisYPos + 5);
        }
        ctx.stroke();
        ctx.restore();
    }

    function drawFunctionCurve(ctx, config, objectiveFunc) {
        ctx.save();
        ctx.strokeStyle = config.funcColor;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        let firstPoint = true;
        const worldXMin = config.canvasToWorldX(0); 
        const worldXMax = config.canvasToWorldX(config.canvas.width); 

        for (let canvasPixelX = 0; canvasPixelX < config.canvas.width; canvasPixelX++) {
            const plotX = config.canvasToWorldX(canvasPixelX);
            const worldY = objectiveFunc(plotX);
            const canvasPos = config.worldToCanvas(plotX, worldY);
            if (canvasPos.y < -config.canvas.height || canvasPos.y > config.canvas.height * 2) {
                if (!firstPoint) ctx.stroke(); 
                firstPoint = true; 
                continue;
            }
            if (firstPoint) {
                ctx.moveTo(canvasPos.x, canvasPos.y);
                firstPoint = false;
            } else {
                ctx.lineTo(canvasPos.x, canvasPos.y);
            }
        }
        if (!firstPoint) ctx.stroke(); 
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
            ctx.arc(point.x, point.y, 3, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }

    function drawCurrentPointAndVector(ctx, config, currentX, currentY, gradX, learningRate) {
        ctx.save();
        const canvasPos = config.worldToCanvas(currentX, currentY);
        ctx.fillStyle = config.pointColor;
        ctx.beginPath();
        ctx.arc(canvasPos.x, canvasPos.y, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#a5281b'; 
        ctx.lineWidth = 1.5;
        ctx.stroke();

        if (gradX !== null && isFinite(gradX)) { 
            const descentDirX = -gradX;
            let stepSizeVisual = descentDirX * learningRate; 
            let vectorLen = Math.abs(stepSizeVisual * config.scale); 
            vectorLen = Math.min(vectorLen, config.canvas.width / 3); 

            if (vectorLen > 1) { 
                const angle = stepSizeVisual > 0 ? 0 : Math.PI; 
                ctx.strokeStyle = config.vectorColor;
                ctx.lineWidth = 2.5;
                ctx.beginPath();
                ctx.moveTo(canvasPos.x, canvasPos.y);
                const endX = canvasPos.x + vectorLen * Math.cos(angle);
                const endY = canvasPos.y; 
                ctx.lineTo(endX, endY);
                const arrowSize = 6;
                ctx.lineTo(endX - arrowSize * Math.cos(angle - Math.PI / 6), endY - arrowSize * Math.sin(angle - Math.PI / 6));
                ctx.moveTo(endX, endY);
                ctx.lineTo(endX - arrowSize * Math.cos(angle + Math.PI / 6), endY - arrowSize * Math.sin(angle + Math.PI / 6));
                ctx.stroke();
            }
        }
        ctx.restore();
    }

    // --- Base Animation/Static Visualization Factory ---
    function createBaseVisualization(chapterId, type = 'animation', customConfig = {}) {
        const canvasId = `${type === 'animation' ? 'canvas' : 'static-canvas'}-${chapterId}`;
        const controlsId = `${type === 'animation' ? 'controls' : 'static-controls'}-${chapterId}`;

        const canvas = document.getElementById(canvasId);
        const controlsDiv = document.getElementById(controlsId);

        const lrSlider = controlsDiv?.querySelector(`input[id^="lrSlider-${chapterId}"], input[id^="static-lrSlider-${chapterId}"]`);
        const lrDisplaySpan = controlsDiv?.querySelector(`.lrDisplay, .static-lrDisplay`);
        const infoText = controlsDiv?.querySelector(type === 'animation' ? '.infoText' : '.staticInfoText');

        const startBtn = controlsDiv?.querySelector(`.start-animation-btn[data-chapter="${chapterId}"]`);
        const pauseBtn = controlsDiv?.querySelector(`.pause-animation-btn[data-chapter="${chapterId}"]`);
        const resetBtn = controlsDiv?.querySelector(`.reset-animation-btn[data-chapter="${chapterId}"]`);
        const fpsSlider = controlsDiv?.querySelector(`input[id^="fpsSlider-${chapterId}"]`);
        const fpsDisplay = controlsDiv?.querySelector(`.fpsDisplay`);
        const noiseSliderAnim = controlsDiv?.querySelector(`input[id="noiseSlider-${chapterId}"]`);
        const noiseDisplayAnim = controlsDiv?.querySelector(`.noiseDisplay`);

        const staticXSlider = controlsDiv?.querySelector(`input[id^="static-xSlider-${chapterId}"]`);
        const staticXDisplay = controlsDiv?.querySelector(`.static-xDisplay`);
        const showStepBtn = controlsDiv?.querySelector(`.show-step-btn[data-chapter="${chapterId}"]`);

        const zoomPanControls = controlsDiv?.querySelector('.zoom-pan-controls');
        const zoomInBtn = zoomPanControls?.querySelector(`button[data-action="zoom-in"]`);
        const zoomOutBtn = zoomPanControls?.querySelector(`button[data-action="zoom-out"]`);
        const panLeftBtn = zoomPanControls?.querySelector(`button[data-action="pan-left"]`);
        const panRightBtn = zoomPanControls?.querySelector(`button[data-action="pan-right"]`);
        const resetViewBtn = zoomPanControls?.querySelector(`button[data-action="reset-view"]`);

        if (!canvas) {
            return null;
        }
        // El lrSlider puede no existir en todos los capítulos (ej. si uno no tuviera control de LR)
        // Por eso se chequea `if (lrSlider && lrDisplaySpan)` más adelante.

        const ctx = canvas.getContext('2d');
        const config = {
            ...commonConfig,
            canvas: canvas, ctx: ctx,
            offsetX: canvas.width / 2, 
            offsetY: canvas.height * 0.85, 
            viewCenterX: customConfig.initialViewCenterX ?? 0, 
            viewCenterY: customConfig.initialViewCenterY ?? (customConfig.objectiveFunction ? customConfig.objectiveFunction(0) : 0), 
            zoomLevel: 1.0,
            ...customConfig
        };
        config.scale = config.baseScale * config.zoomLevel;

        let state = {
            currentX: (type === 'static' && staticXSlider) ? parseFloat(staticXSlider.value) : getRandomStartX(config.startXMin ?? -4, config.startXMax ?? 4, 0.5),
            learningRate: (lrSlider) ? parseFloat(lrSlider.value) : 0.1, // Default LR if slider not present
            historyPoints: [], animationFrameId: null, iteration: 0,
            noiseLevel: (type === 'animation' && noiseSliderAnim) ? parseFloat(noiseSliderAnim.value) : 0,
            isRunning: false, isPaused: false,
            lastFrameTime: 0, targetFps: (type === 'animation' && fpsSlider) ? parseInt(fpsSlider.value) : 30, 
            nextX: null, gradAtCurrentX: null
        };
        
        // --- Inicialización de Displays de Sliders y Listeners 'input' ---
        if (lrSlider && lrDisplaySpan) {
            lrDisplaySpan.textContent = state.learningRate.toFixed(3);
            lrSlider.addEventListener('input', () => {
                const newLr = parseFloat(lrSlider.value);
                lrDisplaySpan.textContent = newLr.toFixed(3);
                state.learningRate = newLr;
                if (type === 'static') {
                    state.nextX = null; 
                    state.gradAtCurrentX = null;
                    draw();
                }
            });
        }

        if (type === 'animation') {
            if (fpsSlider && fpsDisplay) {
                fpsDisplay.textContent = state.targetFps;
                fpsSlider.addEventListener('input', () => {
                    state.targetFps = parseInt(fpsSlider.value);
                    fpsDisplay.textContent = state.targetFps;
                });
            }
            if (noiseSliderAnim && noiseDisplayAnim) {
                noiseDisplayAnim.textContent = state.noiseLevel.toFixed(1);
                noiseSliderAnim.addEventListener('input', () => {
                    state.noiseLevel = parseFloat(noiseSliderAnim.value);
                    noiseDisplayAnim.textContent = state.noiseLevel.toFixed(1);
                    if (!state.isRunning && !state.isPaused) draw(); 
                });
            }
        } else if (type === 'static') {
            if (staticXSlider && staticXDisplay) {
                staticXDisplay.textContent = state.currentX.toFixed(2);
                staticXSlider.addEventListener('input', () => {
                    state.currentX = parseFloat(staticXSlider.value);
                    staticXDisplay.textContent = state.currentX.toFixed(2);
                    state.nextX = null; state.gradAtCurrentX = null;
                    draw();
                });
            }
            // El listener específico para lrSlider en modo estático ya no es necesario aquí,
            // porque el listener general de lrSlider (añadido arriba) ya maneja el caso estático.
        }

        function worldToCanvasLocal(worldX, worldY) {
            const currentScale = config.baseScale * config.zoomLevel;
            const viewOffsetX = config.canvas.width / 2 - config.viewCenterX * currentScale;
            const viewOffsetY = config.canvas.height / 2 + config.viewCenterY * currentScale; 
            return {
                x: viewOffsetX + worldX * currentScale,
                y: viewOffsetY - worldY * currentScale
            };
        }

        function canvasToWorldXLocal(canvasPixelX) {
            const currentScale = config.baseScale * config.zoomLevel;
            const viewOffsetX = config.canvas.width / 2 - config.viewCenterX * currentScale;
            return (canvasPixelX - viewOffsetX) / currentScale;
        }
        const localDrawConfig = { ...config, worldToCanvas: worldToCanvasLocal, canvasToWorldX: canvasToWorldXLocal };

        function draw() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            drawAxes(ctx, localDrawConfig);
            drawFunctionCurve(ctx, localDrawConfig, config.objectiveFunction);

            if (type === 'animation') {
                drawHistory(ctx, localDrawConfig, state.historyPoints);
                const currentY = config.objectiveFunction(state.currentX);
                const gradXVal = config.gradientFunction(state.currentX); 
                drawCurrentPointAndVector(ctx, localDrawConfig, state.currentX, currentY, gradXVal, state.learningRate);
                let status = state.isPaused ? "Pausado" : (state.isRunning ? `Iter: ${state.iteration}` : "Detenido");
                let noiseInfo = (chapterId === 'sgd' && noiseSliderAnim) ? `, Ruido: ${state.noiseLevel.toFixed(1)}` : "";
                if (infoText) infoText.textContent = `${status}, x=${state.currentX.toFixed(3)}, f(x)=${currentY.toFixed(3)}, η=${state.learningRate.toFixed(3)}${noiseInfo}`;
            } else if (type === 'static') {
                const currentY = config.objectiveFunction(state.currentX);
                const gradXVal = state.gradAtCurrentX ?? config.gradientFunction(state.currentX);
                drawCurrentPointAndVector(ctx, localDrawConfig, state.currentX, currentY, gradXVal, state.learningRate);
                if (state.nextX !== null) {
                    const nextY = config.objectiveFunction(state.nextX);
                    const currentPosCanvas = worldToCanvasLocal(state.currentX, currentY);
                    const nextPosCanvas = worldToCanvasLocal(state.nextX, nextY);
                    ctx.save();
                    ctx.fillStyle = config.nextStepColor;
                    ctx.beginPath();
                    ctx.arc(nextPosCanvas.x, nextPosCanvas.y, 6, 0, Math.PI * 2); 
                    ctx.fill();
                    ctx.strokeStyle = config.nextStepColor;
                    ctx.lineWidth = 1.5;
                    ctx.setLineDash([4, 4]);
                    ctx.beginPath();
                    ctx.moveTo(currentPosCanvas.x, currentPosCanvas.y);
                    ctx.lineTo(nextPosCanvas.x, nextPosCanvas.y);
                    ctx.stroke();
                    ctx.setLineDash([]);
                    ctx.restore();
                }
                if (infoText) infoText.textContent = `x=${state.currentX.toFixed(3)}, f(x)=${currentY.toFixed(3)}, η=${state.learningRate.toFixed(3)}. Gradiente en x: ${gradXVal.toFixed(3)}.`;
            }
        }

        function updateAnimation(currentTime) {
            if (!state.isRunning || state.isPaused) {
                if (state.isRunning) state.animationFrameId = requestAnimationFrame(updateAnimation);
                return;
            }
            state.animationFrameId = requestAnimationFrame(updateAnimation);

            const elapsed = currentTime - (state.lastFrameTime || currentTime);
            const frameInterval = 1000 / state.targetFps;
            if (elapsed < frameInterval) return;
            state.lastFrameTime = currentTime - (elapsed % frameInterval);

            let gradX = config.gradientFunction(state.currentX);
            const previousX = state.currentX;

            if (chapterId === 'sgd' && noiseSliderAnim && state.noiseLevel > 0) {
                const noiseMagnitude = state.noiseLevel * (Math.abs(gradX) * 0.5 + 0.2); 
                const noise = (Math.random() - 0.5) * 2 * noiseMagnitude;
                gradX += noise;
            }

            const currentY = config.objectiveFunction(state.currentX);
            const canvasPos = worldToCanvasLocal(state.currentX, currentY);
            state.historyPoints.push({ x: canvasPos.x, y: canvasPos.y });
            if (state.historyPoints.length > config.maxHistory) state.historyPoints.shift();

            state.currentX = state.currentX - state.learningRate * gradX;
            state.iteration++;
            draw();

            const change = Math.abs(state.currentX - previousX);
            if (isNaN(state.currentX) || !isFinite(state.currentX) || state.iteration >= config.maxIterations || (config.targetX !== null && Math.abs(state.currentX - config.targetX) < config.precision) || change < config.precision ) {
                let reason = "Convergencia";
                if (isNaN(state.currentX) || !isFinite(state.currentX)) reason = "Divergencia";
                else if (state.iteration >= config.maxIterations) reason = "Max iteraciones";
                if (infoText) infoText.textContent = `${reason}! x ≈ ${state.currentX.toFixed(3)} en ${state.iteration} iter.`;
                stopAnimationInternal(); 
                return;
            }
        }

        function startAnimation(startX = null) {
            if (activeAnimationId && activeAnimationId !== chapterId + "-animation") {
                const otherChapterId = activeAnimationId.replace("-animation", "");
                gradientAnimations[otherChapterId + "-animation"]?.stopAnimationInternal();
            }
            
            stopAnimationInternal(); 
            state.isRunning = true; state.isPaused = false;
            state.currentX = (startX !== null && isFinite(startX)) ? startX : getRandomStartX(config.startXMin ?? -4, config.startXMax ?? 4, 0.5);
            state.historyPoints = []; state.iteration = 0;
            
            // state.learningRate ya está siendo actualizado por su listener 'input'.
            // Releerlo del slider aquí es una redundancia segura, pero no estrictamente necesario si el listener funciona.
            if (lrSlider) state.learningRate = parseFloat(lrSlider.value); 
            // El display de LR ya se actualiza por el listener 'input', por lo que la siguiente línea es redundante.
            // if (lrDisplaySpan) lrDisplaySpan.textContent = state.learningRate.toFixed(3); // ELIMINADA

            if (type === 'animation' && noiseSliderAnim) state.noiseLevel = parseFloat(noiseSliderAnim.value); 
            state.lastFrameTime = performance.now();

            if (infoText) infoText.textContent = `Iniciando desde x ≈ ${state.currentX.toFixed(2)}...`;
            draw();
            state.animationFrameId = requestAnimationFrame(updateAnimation);
            activeAnimationId = chapterId + "-animation";
        }

        function pauseAnimation() {
            if (state.isRunning && !state.isPaused) {
                state.isPaused = true;
                if (infoText) infoText.textContent = `Pausado en iter ${state.iteration}. x=${state.currentX.toFixed(3)}`;
            }
        }
        function resumeAnimation() {
            if (state.isRunning && state.isPaused) {
                state.isPaused = false;
                state.lastFrameTime = performance.now(); 
                state.animationFrameId = requestAnimationFrame(updateAnimation); 
                if (infoText) infoText.textContent = `Reanudado. Iter: ${state.iteration}...`;
            }
        }
        function stopAnimationInternal() { 
            state.isRunning = false; state.isPaused = false;
            if (state.animationFrameId) cancelAnimationFrame(state.animationFrameId);
            state.animationFrameId = null;
        }
        function resetAnimation() {
            stopAnimationInternal();
            if (activeAnimationId === chapterId + "-animation") activeAnimationId = null; 
            state.currentX = getRandomStartX(config.startXMin ?? -4, config.startXMax ?? 4, 0.5);
            state.historyPoints = []; state.iteration = 0;
            config.viewCenterX = customConfig.initialViewCenterX ?? 0;
            config.viewCenterY = customConfig.initialViewCenterY ?? (config.objectiveFunction ? config.objectiveFunction(0) : 0);
            config.zoomLevel = 1.0;
            updateViewParameters(); 
            if (infoText) infoText.textContent = `Reiniciado. Haz clic en la curva o 'Iniciar'.`;
        }

        function calculateAndShowNextStep() {
            if (type !== 'static') return;
            // state.learningRate ya está actualizado por el listener 'input' del lrSlider.
            // state.currentX ya está actualizado por el listener 'input' del staticXSlider.
            state.gradAtCurrentX = config.gradientFunction(state.currentX);
            state.nextX = state.currentX - state.learningRate * state.gradAtCurrentX;
            draw();
        }

        if (type === 'animation') {
            if (startBtn) startBtn.addEventListener('click', () => startAnimation());
            if (pauseBtn) pauseBtn.addEventListener('click', () => {
                if (state.isRunning && !state.isPaused) pauseAnimation();
                else if (state.isRunning && state.isPaused) resumeAnimation();
            });
            if (resetBtn) resetBtn.addEventListener('click', () => resetAnimation());
            
            canvas.addEventListener('click', (event) => {
                const rect = canvas.getBoundingClientRect();
                const canvasClickX = event.clientX - rect.left;
                const worldClickX = canvasToWorldXLocal(canvasClickX);
                if (isFinite(worldClickX)) {
                    startAnimation(worldClickX);
                }
            });
        } else if (type === 'static') {
            // El listener para staticXSlider ya está configurado arriba para actualizar su display.
            // El listener para lrSlider (en modo estático) también ya está configurado arriba.
            if (showStepBtn) showStepBtn.addEventListener('click', calculateAndShowNextStep);
        }
        
        function updateViewParameters() {
            draw();
        }
        if (zoomInBtn) zoomInBtn.addEventListener('click', () => { config.zoomLevel *= config.zoomFactor; config.zoomLevel = Math.min(config.zoomLevel, 20); updateViewParameters(); });
        if (zoomOutBtn) zoomOutBtn.addEventListener('click', () => { config.zoomLevel /= config.zoomFactor; config.zoomLevel = Math.max(0.05, config.zoomLevel); updateViewParameters(); });
        if (panLeftBtn) panLeftBtn.addEventListener('click', () => { config.viewCenterX -= config.panStep / config.zoomLevel; updateViewParameters(); });
        if (panRightBtn) panRightBtn.addEventListener('click', () => { config.viewCenterX += config.panStep / config.zoomLevel; updateViewParameters(); });
        if (resetViewBtn) resetViewBtn.addEventListener('click', () => {
            config.viewCenterX = customConfig.initialViewCenterX ?? 0;
            config.viewCenterY = customConfig.initialViewCenterY ?? (config.objectiveFunction ? config.objectiveFunction(0) : 0);
            config.zoomLevel = 1.0;
            updateViewParameters();
        });

        canvas.addEventListener('wheel', (event) => {
            event.preventDefault();
            const zoomSensibility = 0.1; 
            if (event.deltaY < 0) config.zoomLevel *= (1 + zoomSensibility); 
            else config.zoomLevel /= (1 + zoomSensibility); 
            config.zoomLevel = Math.max(0.05, Math.min(config.zoomLevel, 20));
            updateViewParameters();
        }, { passive: false });

        return {
            startAnimation, pauseAnimation, resumeAnimation, resetAnimation, stopAnimationInternal,
            draw, calculateAndShowNextStep,
            type, 
            get state() { return state; }, 
            get config() { return config; } 
        };
    } 


    const chaptersWithViz = { 
        'batch-gd': {
            animation: { startXMin: -4, startXMax: 4 },
            static: { startXMin: -5, startXMax: 5, initialX: 2.5 } 
        },
        'learning-rate': {
            animation: { startXMin: -4, startXMax: 4 }
        },
        'sgd': {
            animation: { startXMin: -4, startXMax: 4, noiseSlider: true } 
        },
        'challenges': {
            sharedConfig: { 
                objectiveFunction: x => 0.05 * Math.pow(x, 4) - 0.75 * Math.pow(x, 2) + 0.25 * x + 3, 
                gradientFunction: x => 0.2 * Math.pow(x, 3) - 1.5 * x + 0.25,
                initialViewCenterY: 2, 
                baseScale: 35, 
                startXMin: -4.5, startXMax: 4.5, targetX: null
            },
            animation: {}, 
            static: {}    
        }
    };

    Object.keys(chaptersWithViz).forEach(chapterId => {
        const chapterVizConfigs = chaptersWithViz[chapterId];
        if (chapterVizConfigs.animation) {
            const animConfig = { ...(chapterVizConfigs.sharedConfig || {}), ...chapterVizConfigs.animation };
            const animViz = createBaseVisualization(chapterId, 'animation', animConfig);
            if (animViz) {
                gradientAnimations[chapterId + "-animation"] = animViz;
                animViz.draw(); 
            }
        }
        if (chapterVizConfigs.static) {
            const staticConfig = { ...(chapterVizConfigs.sharedConfig || {}), ...chapterVizConfigs.static };
            const staticViz = createBaseVisualization(chapterId, 'static', staticConfig);
            if (staticViz) {
                gradientAnimations[chapterId + "-static"] = staticViz;
                staticViz.draw(); 
            }
        }
    });

    document.querySelectorAll('.visualization-tabs .tab-button').forEach(button => {
        button.addEventListener('click', () => {
            const chapterId = button.dataset.chapter;
            const tabType = button.dataset.tab; 

            document.querySelectorAll(`.chapter[id="chapter-${chapterId}"] .tab-content`).forEach(tc => tc.classList.remove('active'));
            document.querySelectorAll(`.chapter[id="chapter-${chapterId}"] .tab-button`).forEach(tb => tb.classList.remove('active'));

            const contentToShow = document.getElementById(`${tabType}-content-${chapterId}`);
            if (contentToShow) contentToShow.classList.add('active');
            button.classList.add('active');

            const vizInstance = gradientAnimations[chapterId + "-" + tabType];
            if (vizInstance) {
                vizInstance.draw();
            }
        });
    });
    
    document.querySelectorAll('.visualization-tabs').forEach(tabContainer => {
        const firstButton = tabContainer.querySelector('.tab-button');
        if (firstButton) firstButton.click(); 
    });

    window.addEventListener('beforeunload', () => {
        Object.values(gradientAnimations).forEach(viz => {
            if (viz.type === 'animation' && viz.state && viz.state.isRunning) { 
                viz.stopAnimationInternal(); 
            }
        });
    });

    console.log("Guía Interactiva Avanzada Inicializada. Visualizaciones:", gradientAnimations);

});