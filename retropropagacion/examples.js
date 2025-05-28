class InteractiveExample {
            constructor(idPrefix, svgId) {
                this.idPrefix = idPrefix;
                this.svg = document.getElementById(svgId);
                if (!this.svg) {
                    console.error(`Elemento SVG con ID ${svgId} no encontrado para ${idPrefix}.`);
                    return; 
                }
                this.svgWidth = parseInt(this.svg.getAttribute('width')) || 400; 
                this.svgHeight = parseInt(this.svg.getAttribute('height')) || 400; 

                this.animationFrameId = null;
                this.isPaused = true;
                this.iterationCount = 0;
                this.lastFrameTime = 0;
                this._loop = this._loop.bind(this);
            }

            _createSvgElement(tag, attributes) {
                return createSvgElementUtility(tag, attributes);
            }

            _loop() {
                this.animationFrameId = requestAnimationFrame(this._loop);
                const now = performance.now();
                const elapsed = now - this.lastFrameTime;

                if (elapsed > GlobalAnimSettings.fpsInterval) {
                    this.lastFrameTime = now - (elapsed % GlobalAnimSettings.fpsInterval);
                    if (!this.isPaused) {
                        this.step(); 
                        this.draw(); 
                    }
                }
            }

            start() {
                if (this.isPaused) {
                    this.isPaused = false;
                    this.lastFrameTime = performance.now(); 
                    if (!this.animationFrameId) this._loop(); 
                    showMessage(`Simulación ${this.idPrefix.toUpperCase()} iniciada.`);
                }
            }

            pause() {
                this.isPaused = true;
                showMessage(`Simulación ${this.idPrefix.toUpperCase()} pausada.`);
            }
            
            initDOMAndListeners() { throw new Error("El método 'initDOMAndListeners()' debe ser implementado."); }
            reset() { throw new Error("El método 'reset()' debe ser implementado."); }
            step() { throw new Error("El método 'step()' debe ser implementado."); }
            draw() { throw new Error("El método 'draw()' debe ser implementado."); }
        }

        // --- Ejemplo 1: Regresión Lineal 1D ---
        class LinearRegressionExample extends InteractiveExample { /* ... (sin cambios significativos) ... */ 
            constructor() {
                super('ex1', 'example-svg-ex1');
                this.padding = 50; 
                this.maxXData = 10; 
                this.maxYData = 30; 
                this.dataPoints = [];
                this.m = 0; 
                this.c = 0; 
                this.learningRate = 0.005;
                this.initDOMAndListeners();
                this.reset();
            }

            initDOMAndListeners() {
                this.iterationCountDisplay = document.getElementById('iterationCount_ex1');
                this.errorValueDisplay = document.getElementById('errorValue_ex1');
                this.slopeValueDisplay = document.getElementById('slopeValue_ex1');
                this.interceptValueDisplay = document.getElementById('interceptValue_ex1');
                this.learningRateInput = document.getElementById('learningRate_ex1_input');

                document.getElementById('startButton_ex1').addEventListener('click', () => this.start());
                document.getElementById('pauseButton_ex1').addEventListener('click', () => this.pause());
                document.getElementById('resetButton_ex1').addEventListener('click', () => this.reset());
                document.getElementById('stepButton_ex1').addEventListener('click', () => {
                    this.pause(); this.step(); this.draw(); showMessage("Un paso Ejemplo 1 realizado.");
                });
                this.learningRateInput.addEventListener('change', (event) => {
                    const newLr = parseFloat(event.target.value);
                    if (!isNaN(newLr) && newLr > 0.00001 && newLr <= 0.1 ) { 
                        this.learningRate = newLr;
                        showMessage(`Tasa de aprendizaje Ejemplo 1 actualizada a ${this.learningRate}.`);
                    } else {
                        event.target.value = this.learningRate; 
                        showMessage("Tasa de aprendizaje Inválida. Use valor entre 0.0001 y 0.1.", 3000);
                    }
                });
            }
            
            mapXToSVG(dataX) { return this.padding + (dataX / this.maxXData) * (this.svgWidth - 2 * this.padding); }
            mapYToSVG(dataY) { return (this.svgHeight - this.padding) - (dataY / this.maxYData) * (this.svgHeight - 2 * this.padding); }

            generateData() {
                this.dataPoints = [];
                const trueSlope = 2; const trueIntercept = 5;
                for (let i = 0; i < 30; i++) {
                    const x = Math.random() * this.maxXData; 
                    const y_ideal = trueSlope * x + trueIntercept;
                    const noise = (Math.random() - 0.5) * (0.3 * this.maxYData); 
                    let y = y_ideal + noise;
                    y = Math.max(0, Math.min(this.maxYData, y)); 
                    this.dataPoints.push({ x: x, y: y });
                }
            }

            reset() {
                this.pause();
                this.m = Math.random() * 4 - 2; 
                this.c = Math.random() * (this.maxYData * 0.5); 
                this.iterationCount = 0;
                const lrValue = parseFloat(this.learningRateInput.value);
                this.learningRate = (!isNaN(lrValue) && lrValue > 0 && lrValue <= 0.1) ? lrValue : 0.005;
                this.learningRateInput.value = this.learningRate;
                this.generateData(); 
                this.draw();
                if(this.errorValueDisplay) this.errorValueDisplay.textContent = "N/A";
            }

            step() {
                if (this.dataPoints.length === 0) return;
                let sumErrorX = 0; let sumError = 0;
                const N = this.dataPoints.length;
                this.dataPoints.forEach(point => {
                    const predictedY = this.m * point.x + this.c;
                    const error = predictedY - point.y; 
                    sumErrorX += point.x * error;
                    sumError += error;
                });
                this.m -= this.learningRate * (2/N) * sumErrorX;
                this.c -= this.learningRate * (2/N) * sumError;
                this.iterationCount++;
            }

            draw() {
                if (!this.svg) return;
                this.svg.innerHTML = ''; 

                this.svg.appendChild(this._createSvgElement('line', {x1:this.mapXToSVG(0), y1:this.mapYToSVG(0), x2:this.mapXToSVG(this.maxXData), y2:this.mapYToSVG(0), stroke:'#aaa'}));
                this.svg.appendChild(this._createSvgElement('line', {x1:this.mapXToSVG(0), y1:this.mapYToSVG(0), x2:this.mapXToSVG(0), y2:this.mapYToSVG(this.maxYData), stroke:'#aaa'}));

                this.dataPoints.forEach(point => {
                    this.svg.appendChild(this._createSvgElement('circle', {cx:this.mapXToSVG(point.x), cy:this.mapYToSVG(point.y), r:4, fill:'#007bff'}));
                });

                let y_start_data = this.m * 0 + this.c; 
                let y_end_data = this.m * this.maxXData + this.c; 
                this.svg.appendChild(this._createSvgElement('line', {x1:this.mapXToSVG(0), y1:this.mapYToSVG(y_start_data), x2:this.mapXToSVG(this.maxXData), y2:this.mapYToSVG(y_end_data), stroke:'red', 'stroke-width':2}));

                this.iterationCountDisplay.textContent = this.iterationCount;
                this.slopeValueDisplay.textContent = this.m.toFixed(3);
                this.interceptValueDisplay.textContent = this.c.toFixed(3);
                
                let totalError = 0;
                if (this.dataPoints.length > 0) {
                    this.dataPoints.forEach(point => {
                        const predictedY = this.m * point.x + this.c;
                        totalError += Math.pow(point.y - predictedY, 2);
                    });
                    this.errorValueDisplay.textContent = (totalError / this.dataPoints.length).toFixed(3);
                } else {
                    this.errorValueDisplay.textContent = "N/A";
                }
            }
        }

        // --- Ejemplo 2: Neurona Simple 1D ---
        class SimpleNeuronExample extends InteractiveExample { /* ... (sin cambios significativos) ... */ 
             constructor() {
                super('ex2', 'example-svg-ex2');
                this.inputX = 0.5; this.targetY = 0.8;
                this.weightW = 0.1; this.biasB = 0.1;
                this.learningRate = 0.1;
                this.z = 0; this.outputY = 0;
                this.initDOMAndListeners();
                this.reset();
            }

            initDOMAndListeners() {
                this.inputX_input = document.getElementById('inputX_ex2_input');
                this.targetY_input = document.getElementById('targetY_ex2_input');
                this.learningRateInput = document.getElementById('learningRate_ex2_input');
                this.iterationCountDisplay = document.getElementById('iterationCount_ex2');
                this.weightWDisplay = document.getElementById('weightW_ex2');
                this.biasBDisplay = document.getElementById('biasB_ex2');
                this.zDisplay = document.getElementById('z_ex2');
                this.outputYDisplay = document.getElementById('outputY_ex2');
                this.errorValueDisplay = document.getElementById('errorValue_ex2');

                document.getElementById('startButton_ex2').addEventListener('click', () => this.start());
                document.getElementById('pauseButton_ex2').addEventListener('click', () => this.pause());
                document.getElementById('resetButton_ex2').addEventListener('click', () => this.reset());
                document.getElementById('stepButton_ex2').addEventListener('click', () => {
                    this.pause(); this.step(); this.draw(); showMessage("Un paso Ejemplo 2 realizado.");
                });

                this.inputX_input.addEventListener('change', () => this.reset());
                this.targetY_input.addEventListener('change', () => this.reset());
                this.learningRateInput.addEventListener('change', (e) => {
                    this.learningRate = parseFloat(e.target.value) || 0.1;
                    showMessage(`Tasa de aprendizaje Ejemplo 2 actualizada a ${this.learningRate}.`);
                });
            }

            _sigmoid(z) { return 1 / (1 + Math.exp(-z)); }
            _sigmoidDerivative(z) { const s = this._sigmoid(z); return s * (1 - s); }

            _forwardPass() {
                this.z = this.weightW * this.inputX + this.biasB;
                this.outputY = this._sigmoid(this.z);
            }
            
            reset() {
                this.pause();
                this.inputX = parseFloat(this.inputX_input.value) || 0.5;
                this.targetY = parseFloat(this.targetY_input.value) || 0.8;
                this.learningRate = parseFloat(this.learningRateInput.value) || 0.1;
                this.weightW = Math.random() * 0.2 - 0.1; 
                this.biasB = Math.random() * 0.2 - 0.1;  
                this.iterationCount = 0;
                this._forwardPass(); 
                this.draw();
                if(this.errorValueDisplay) this.errorValueDisplay.textContent = "N/A";
            }

            step() {
                this._forwardPass();
                const error = this.outputY - this.targetY; 
                const dL_dOutputY = error; 
                const dOutputY_dZ = this._sigmoidDerivative(this.z);
                const dZ_dW = this.inputX;
                const dZ_dB = 1;

                const gradientW = dL_dOutputY * dOutputY_dZ * dZ_dW;
                const gradientB = dL_dOutputY * dOutputY_dZ * dZ_dB;
                
                this.weightW -= this.learningRate * gradientW;
                this.biasB -= this.learningRate * gradientB;
                this.iterationCount++;
            }

            draw() {
                if (!this.svg) return;
                this.svg.innerHTML = '';
                const textStyle = "font-family: 'Inter', sans-serif; font-size: 14px;";
                const neuronRadius = 30;
                const startX = 50, neuronX = 200, outputX = 400, targetX = 550;
                const commonY = this.svgHeight / 2;

                let textEl = this._createSvgElement('text', {x:startX, y:commonY - 30, style:textStyle});
                textEl.textContent = `Input x: ${this.inputX.toFixed(2)}`; this.svg.appendChild(textEl);
                this.svg.appendChild(this._createSvgElement('line', {x1:startX+40, y1:commonY, x2:neuronX-neuronRadius, y2:commonY, stroke:'#555', 'stroke-width':2}));
                this.svg.appendChild(this._createSvgElement('circle', {cx:neuronX, cy:commonY, r:neuronRadius, fill:'#a0c4ff', stroke:'#007bff'}));
                
                textEl = this._createSvgElement('text', {x:neuronX, y:commonY-5, 'text-anchor':'middle', style:textStyle + "font-size:12px;"});
                textEl.textContent = `w:${this.weightW.toFixed(2)}`; this.svg.appendChild(textEl);
                textEl = this._createSvgElement('text', {x:neuronX, y:commonY+15, 'text-anchor':'middle', style:textStyle + "font-size:12px;"});
                textEl.textContent = `b:${this.biasB.toFixed(2)}`; this.svg.appendChild(textEl);
                
                this.svg.appendChild(this._createSvgElement('line', {x1:neuronX+neuronRadius, y1:commonY, x2:outputX-10, y2:commonY, stroke:'#555', 'stroke-width':2}));
                textEl = this._createSvgElement('text', {x:outputX, y:commonY-15, style:textStyle});
                textEl.textContent = `Output ŷ: ${this.outputY.toFixed(3)}`; this.svg.appendChild(textEl);
                textEl = this._createSvgElement('text', {x:outputX, y:commonY+15, style:textStyle + "font-size:12px;"});
                textEl.textContent = `(z: ${this.z.toFixed(2)})`; this.svg.appendChild(textEl);
                textEl = this._createSvgElement('text', {x:targetX-30, y:commonY-15, style:textStyle + "fill: green;"});
                textEl.textContent = `Target: ${this.targetY.toFixed(2)}`; this.svg.appendChild(textEl);

                const mse = 0.5 * Math.pow(this.outputY - this.targetY, 2);
                this.errorValueDisplay.textContent = mse.toFixed(4);
                this.iterationCountDisplay.textContent = this.iterationCount;
                this.weightWDisplay.textContent = this.weightW.toFixed(3);
                this.biasBDisplay.textContent = this.biasB.toFixed(3);
                this.zDisplay.textContent = this.z.toFixed(3);
                this.outputYDisplay.textContent = this.outputY.toFixed(3);
            }
        }

        // --- Ejemplo 3: Descenso de Gradiente 2D ---
        class GradientDescent2DExample extends InteractiveExample { /* ... (sin cambios significativos) ... */ 
            constructor() {
                super('ex3', 'example-svg-ex3');
                this.padding = 40; this.dataRange = 5;
                this.currentX = 4; this.currentY = 4;
                this.startX = 4; this.startY = 4;
                this.learningRate = 0.1;
                this.pathHistory = [];
                this.initDOMAndListeners();
                this.reset();
            }

            initDOMAndListeners() {
                this.startX_input = document.getElementById('startX_ex3_input');
                this.startY_input = document.getElementById('startY_ex3_input');
                this.learningRateInput = document.getElementById('learningRate_ex3_input');
                this.iterationCountDisplay = document.getElementById('iterationCount_ex3');
                this.currentXDisplay = document.getElementById('currentX_ex3');
                this.currentYDisplay = document.getElementById('currentY_ex3');
                this.costValueDisplay = document.getElementById('costValue_ex3');

                document.getElementById('startButton_ex3').addEventListener('click', () => this.start());
                document.getElementById('pauseButton_ex3').addEventListener('click', () => this.pause());
                document.getElementById('resetButton_ex3').addEventListener('click', () => this.reset());
                document.getElementById('stepButton_ex3').addEventListener('click', () => {
                    this.pause(); this.step(); this.draw(); showMessage("Un paso Ejemplo 3 realizado.");
                });
                this.startX_input.addEventListener('change', () => this.reset());
                this.startY_input.addEventListener('change', () => this.reset());
                this.learningRateInput.addEventListener('change', (e) => {
                    this.learningRate = parseFloat(e.target.value) || 0.1;
                    showMessage(`Tasa de aprendizaje Ejemplo 3 actualizada a ${this.learningRate}.`);
                });
            }

            _mapToSVG(dataVal) { return this.padding + ((dataVal + this.dataRange) / (2 * this.dataRange)) * (this.svgWidth - 2 * this.padding); }
            _costFunction(x, y) { return x*x + y*y; }
            _gradX(x) { return 2*x; }
            _gradY(y) { return 2*y; }

            reset() {
                this.pause();
                this.startX = parseFloat(this.startX_input.value) || 4;
                this.startY = parseFloat(this.startY_input.value) || 4;
                this.learningRate = parseFloat(this.learningRateInput.value) || 0.1;
                this.currentX = this.startX; this.currentY = this.startY;
                this.iterationCount = 0;
                this.pathHistory = [{x: this.currentX, y: this.currentY}];
                this.draw();
                if(this.costValueDisplay) this.costValueDisplay.textContent = this._costFunction(this.currentX, this.currentY).toFixed(3);
            }

            step() {
                const gx = this._gradX(this.currentX);
                const gy = this._gradY(this.currentY);
                this.currentX -= this.learningRate * gx;
                this.currentY -= this.learningRate * gy;
                this.pathHistory.push({x: this.currentX, y: this.currentY});
                if (this.pathHistory.length > 200) this.pathHistory.shift();
                this.iterationCount++;
            }

            draw() {
                if (!this.svg) return;
                this.svg.innerHTML = '';
                for (let r = 0.5; r <= this.dataRange * 1.2 ; r += 0.8) {
                    const radiusSVG = r * (this.svgWidth - 2 * this.padding) / (2 * this.dataRange);
                    this.svg.appendChild(this._createSvgElement('circle', {cx:this._mapToSVG(0), cy:this._mapToSVG(0), r:radiusSVG, stroke:'#d1d5db', 'stroke-dasharray':'4 2', fill:'none'}));
                }
                this.svg.appendChild(this._createSvgElement('line', {x1:this._mapToSVG(-this.dataRange), y1:this._mapToSVG(0), x2:this._mapToSVG(this.dataRange), y2:this._mapToSVG(0), stroke:'#9ca3af'}));
                this.svg.appendChild(this._createSvgElement('line', {x1:this._mapToSVG(0), y1:this._mapToSVG(-this.dataRange), x2:this._mapToSVG(0), y2:this._mapToSVG(this.dataRange), stroke:'#9ca3af'}));

                if (this.pathHistory.length > 1) {
                    let pointsStr = this.pathHistory.map(p => `${this._mapToSVG(p.x)},${this._mapToSVG(p.y)}`).join(" ");
                    this.svg.appendChild(this._createSvgElement('polyline', {points:pointsStr.trim(), stroke:"#fbbf24", 'stroke-width':"1.5", fill:"none"}));
                }
                this.svg.appendChild(this._createSvgElement('circle', {cx:this._mapToSVG(this.currentX), cy:this._mapToSVG(this.currentY), r:5, fill:'#ef4444'}));

                this.iterationCountDisplay.textContent = this.iterationCount;
                this.currentXDisplay.textContent = this.currentX.toFixed(3);
                this.currentYDisplay.textContent = this.currentY.toFixed(3);
                this.costValueDisplay.textContent = this._costFunction(this.currentX, this.currentY).toFixed(3);
            }
        }
        
        // --- Ejemplo 4: Clasificador Lineal Múltiple (Capa de Perceptrones) ---
        class MultiPerceptronExample extends InteractiveExample { /* ... (sin cambios significativos) ... */ 
            constructor() {
                super('ex4', 'example-svg-ex4'); 
                this.padding = 40;
                this.dataRange = 5; 
                this.dataPoints = []; 
                this.perceptrons = []; 
                this.numNeurons = 5; 
                this.activeNeuronIndex = 0; 
                this.learningRate = 0.05;
                this.initDOMAndListeners();
                this.reset();
            }

            initDOMAndListeners() {
                this.numNeuronsInput = document.getElementById('numNeurons_ex4_input');
                this.numNeuronsDisplay = document.getElementById('numNeurons_ex4_display');
                this.learningRateInput = document.getElementById('learningRate_ex4_input');
                this.iterationCountDisplay = document.getElementById('iterationCount_ex4'); 
                this.activeNeuronIdDisplay = document.getElementById('activeNeuronId_ex4');
                this.weightsWxDisplay = document.getElementById('weights_ex4_wx');
                this.weightsWyDisplay = document.getElementById('weights_ex4_wy');
                this.weightsBDisplay = document.getElementById('weights_ex4_b');
                this.accuracyActiveDisplay = document.getElementById('accuracy_active_ex4');
                this.accuracyAvgDisplay = document.getElementById('accuracy_avg_ex4');

                this.numNeuronsInput.addEventListener('input', (event) => { 
                    this.numNeurons = parseInt(event.target.value);
                    this.numNeuronsDisplay.textContent = this.numNeurons;
                });
                this.numNeuronsInput.addEventListener('change', () => { 
                    this.reset(); 
                    showMessage(`Número de Perceptrones ajustado a ${this.numNeurons}. Simulación reiniciada.`);
                });

                document.getElementById('generateData_ex4').addEventListener('click', () => {
                    this.generateData(); 
                    this.resetAllPerceptrons(); 
                    this.draw(); 
                    showMessage("Nuevos datos generados para Ejemplo 4.");
                });
                document.getElementById('startButton_ex4').addEventListener('click', () => this.start());
                document.getElementById('pauseButton_ex4').addEventListener('click', () => this.pause());
                document.getElementById('resetButton_ex4').addEventListener('click', () => this.reset());
                document.getElementById('stepButton_ex4').addEventListener('click', () => {
                    this.pause(); this.step(); this.draw(); showMessage("Un paso Ejemplo 4 realizado.");
                });
                this.learningRateInput.addEventListener('change', (event) => {
                    const newLr = parseFloat(event.target.value);
                    if (!isNaN(newLr) && newLr > 0.0001 && newLr <= 0.5 ) { 
                        this.learningRate = newLr;
                        showMessage(`Tasa de aprendizaje Ejemplo 4 actualizada a ${this.learningRate}.`);
                    } else {
                        event.target.value = this.learningRate; 
                        showMessage("Tasa de aprendizaje Inválida. Use valor entre 0.001 y 0.5.", 3000);
                    }
                });
            }

            _mapToSVG(dataVal) { 
                return this.padding + ((dataVal + this.dataRange) / (2 * this.dataRange)) * (this.svgWidth - 2 * this.padding);
            }

            generateData(numPointsPerClass = 25) {
                this.dataPoints = [];
                const offset = this.dataRange / 3;
                for (let i = 0; i < numPointsPerClass; i++) {
                    this.dataPoints.push({
                        x: (Math.random() * this.dataRange * 0.8) - this.dataRange * 0.4 - offset + (Math.random()-0.5)*1.5,
                        y: (Math.random() * this.dataRange * 0.8) - this.dataRange * 0.4 - offset + (Math.random()-0.5)*1.5,
                        type: -1
                    });
                }
                for (let i = 0; i < numPointsPerClass; i++) {
                    this.dataPoints.push({
                        x: (Math.random() * this.dataRange * 0.8) - this.dataRange * 0.4 + offset + (Math.random()-0.5)*1.5,
                        y: (Math.random() * this.dataRange * 0.8) - this.dataRange * 0.4 + offset + (Math.random()-0.5)*1.5,
                        type: 1
                    });
                }
                for (let i = this.dataPoints.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [this.dataPoints[i], this.dataPoints[j]] = [this.dataPoints[j], this.dataPoints[i]];
                }
            }
            
            resetAllPerceptrons() {
                this.perceptrons = [];
                for (let i = 0; i < this.numNeurons; i++) {
                    this.perceptrons.push({
                        id: i + 1,
                        wx: Math.random() * 0.4 - 0.2, 
                        wy: Math.random() * 0.4 - 0.2,
                        b: Math.random() * 0.2 - 0.1  
                    });
                }
                this.activeNeuronIndex = 0;
                this.iterationCount = 0; 
            }

            reset() {
                this.pause();
                this.numNeurons = parseInt(this.numNeuronsInput.value); 
                this.numNeuronsDisplay.textContent = this.numNeurons;
                this.generateData();
                this.resetAllPerceptrons();
                const lrValue = parseFloat(this.learningRateInput.value);
                this.learningRate = (!isNaN(lrValue) && lrValue > 0.0001 && lrValue <= 0.5) ? lrValue : 0.05;
                this.learningRateInput.value = this.learningRate;
                this.draw();
                if(this.accuracyActiveDisplay) this.accuracyActiveDisplay.textContent = "N/A";
                if(this.accuracyAvgDisplay) this.accuracyAvgDisplay.textContent = "N/A";
            }
            
            _predict(perceptron, x, y) {
                const activation = perceptron.wx * x + perceptron.wy * y + perceptron.b;
                return activation >= 0 ? 1 : -1;
            }

            step() {
                if (this.dataPoints.length === 0 || this.perceptrons.length === 0) return;
                
                const currentPerceptron = this.perceptrons[this.activeNeuronIndex];
                if (!currentPerceptron) return;

                const point = this.dataPoints[Math.floor(Math.random() * this.dataPoints.length)];
                const prediction = this._predict(currentPerceptron, point.x, point.y);
                
                if (prediction !== point.type) {
                    currentPerceptron.wx += this.learningRate * point.type * point.x;
                    currentPerceptron.wy += this.learningRate * point.type * point.y;
                    currentPerceptron.b  += this.learningRate * point.type;
                }
                
                this.iterationCount++; 
                this.activeNeuronIndex = (this.activeNeuronIndex + 1) % this.numNeurons;
            }

            _calculateAccuracyForPerceptron(perceptron) {
                if (this.dataPoints.length === 0) return 0;
                let correctCount = 0;
                this.dataPoints.forEach(point => {
                    if (this._predict(perceptron, point.x, point.y) === point.type) {
                        correctCount++;
                    }
                });
                return (correctCount / this.dataPoints.length) * 100;
            }

            _calculateAverageAccuracy() {
                if (this.perceptrons.length === 0) return 0;
                let totalAccuracy = 0;
                this.perceptrons.forEach(p => {
                    totalAccuracy += this._calculateAccuracyForPerceptron(p);
                });
                return totalAccuracy / this.perceptrons.length;
            }

            draw() {
                if (!this.svg) return;
                this.svg.innerHTML = '';

                this.svg.appendChild(this._createSvgElement('line', {x1:this._mapToSVG(-this.dataRange), y1:this._mapToSVG(0), x2:this._mapToSVG(this.dataRange), y2:this._mapToSVG(0), stroke:'#ccc'}));
                this.svg.appendChild(this._createSvgElement('line', {x1:this._mapToSVG(0), y1:this._mapToSVG(-this.dataRange), x2:this._mapToSVG(0), y2:this._mapToSVG(this.dataRange), stroke:'#ccc'}));

                this.dataPoints.forEach(point => {
                    this.svg.appendChild(this._createSvgElement('circle', {
                        cx: this._mapToSVG(point.x), 
                        cy: this._mapToSVG(point.y), 
                        r: 4, 
                        fill: point.type === 1 ? '#3b82f6' : '#ef4444' 
                    }));
                });

                this.perceptrons.forEach((p, index) => {
                    let x1_svg, y1_svg, x2_svg, y2_svg;
                    const x_min_data = -this.dataRange;
                    const x_max_data = this.dataRange;
                    const isActive = index === this.activeNeuronIndex;

                    if (Math.abs(p.wy) > 1e-5) { 
                        let y1_data = (-p.wx * x_min_data - p.b) / p.wy;
                        let y2_data = (-p.wx * x_max_data - p.b) / p.wy;
                        x1_svg = this._mapToSVG(x_min_data); y1_svg = this._mapToSVG(y1_data);
                        x2_svg = this._mapToSVG(x_max_data); y2_svg = this._mapToSVG(y2_data);
                    } else if (Math.abs(p.wx) > 1e-5) { 
                        let x_data = -p.b / p.wx;
                        x1_svg = this._mapToSVG(x_data); y1_svg = this._mapToSVG(-this.dataRange);
                        x2_svg = this._mapToSVG(x_data); y2_svg = this._mapToSVG(this.dataRange);
                    } else { 
                        x1_svg = x2_svg = y1_svg = y2_svg = 0; 
                    }
                    if (x1_svg !== 0 || y1_svg !==0 ) {
                        this.svg.appendChild(this._createSvgElement('line', {
                            x1: x1_svg, y1: y1_svg, x2: x2_svg, y2: y2_svg,
                            stroke: isActive ? '#10b981' : '#a5f3fc', 
                            'stroke-width': isActive ? 2.5 : 1.5,
                            opacity: isActive ? 1 : 0.6
                        }));
                    }
                });

                this.iterationCountDisplay.textContent = this.iterationCount;
                const activeP = this.perceptrons[this.activeNeuronIndex];
                if (activeP) {
                    this.activeNeuronIdDisplay.textContent = activeP.id;
                    this.weightsWxDisplay.textContent = activeP.wx.toFixed(2);
                    this.weightsWyDisplay.textContent = activeP.wy.toFixed(2);
                    this.weightsBDisplay.textContent = activeP.b.toFixed(2);
                    this.accuracyActiveDisplay.textContent = this._calculateAccuracyForPerceptron(activeP).toFixed(1) + '%';
                } else {
                    this.activeNeuronIdDisplay.textContent = "N/A";
                    this.weightsWxDisplay.textContent = "N/A";
                    this.weightsWyDisplay.textContent = "N/A";
                    this.weightsBDisplay.textContent = "N/A";
                    this.accuracyActiveDisplay.textContent = "N/A";
                }
                this.accuracyAvgDisplay.textContent = this._calculateAverageAccuracy().toFixed(1) + '%';
            }
        }


        // --- Inicialización General ---
        document.addEventListener('DOMContentLoaded', () => {
             try {
                const ex1 = new LinearRegressionExample();
                const ex2 = new SimpleNeuronExample();
                const ex3 = new GradientDescent2DExample();
                const ex4 = new MultiPerceptronExample(); 
            } catch (e) {
                console.error("Error al inicializar uno o más ejemplos:", e);
                showMessage("Error al inicializar ejemplos interactivos. Ver consola.", 5000);
            }
        }); 