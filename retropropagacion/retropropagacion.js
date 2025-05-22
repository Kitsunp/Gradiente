// --- Utilidad Global para Crear Elementos SVG ---
        function createSvgElementUtility(tag, attributes) {
            const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
            for (const key in attributes) {
                el.setAttribute(key, attributes[key]);
            }
            return el;
        }

        // --- Variables Globales y Funciones de Utilidad ---
        function showMessage(message, duration = 2000) { 
            const messageBox = document.getElementById('custom-message-box');
            if (!messageBox) return;
            messageBox.textContent = message;
            messageBox.style.display = 'block';
            setTimeout(() => {
                messageBox.style.display = 'none';
            }, duration);
        }

        const GlobalAnimSettings = {
            desiredFPS: 30,
            fpsInterval: 1000 / 30,
            updateFPS(newFPSStr) {
                const newFPS = parseInt(newFPSStr);
                if (!isNaN(newFPS) && newFPS > 0 && newFPS <= 120) {
                    this.desiredFPS = newFPS;
                    this.fpsInterval = 1000 / this.desiredFPS;
                    showMessage(`FPS ajustado a ${this.desiredFPS}.`);
                } else {
                    document.getElementById('fpsControl').value = this.desiredFPS;
                    showMessage("FPS inválido. Use un valor entre 1 y 120.", 3000);
                }
            }
        };
        
        let GlobalShowFormulaAnnotations = false; // Variable global para la opción de mostrar fórmulas

        // --- Gestión de Subtemas y Diagramas Interactivos ---
        const diagramInstances = {}; 

        // --- Plantillas de Estilo para Nodos y Conexiones (Fase 1) ---
        const nodeTemplates = {
            default: { radius: 15, fill: '#e9ecef', stroke: '#adb5bd', 'stroke-width': 1.5, textColor: '#333', fontSize: '9px' },
            input: { fill: '#d1fae5', stroke: '#059669', radius: 15 },
            neuron: { fill: '#a0c4ff', stroke: '#007bff', radius: 20 },
            output: { fill: '#fed7aa', stroke: '#f97316', radius: 20 },
            sum: { fill: '#fff0b3', stroke: '#ffc107', radius: 22, fontSize: '12px', textColor: '#444' },
            bias: { fill: '#e0e7ff', stroke: '#4f46e5', radius: 15, fontSize: '10px' },
            error: { fill: '#fecaca', stroke: '#dc2626', radius: 22 },
            grad: { fill: '#fee2e2', stroke: '#b91c1c', radius: 18 }
        };

        const connectionTemplates = {
            default: { stroke: '#6b7280', 'stroke-width': 1, labelFill: '#555', labelFontSize: '8px' },
            highlighted: { stroke: '#007bff', 'stroke-width': 2.5, labelFill: '#0056b3', labelFontSize: '9px' },
            dashed: { 'stroke-dasharray': '4 2', stroke: '#a0aec0', 'stroke-width': 1.5 },
            errorFlow: { stroke: '#ef4444', 'stroke-width': 1.5, 'stroke-dasharray': '5 3', labelFill: '#c53030'}
        };
        // --- Fin Plantillas ---

        // --- Funciones Generadoras de Estructuras (Fase 2) ---
        function generateDetailedNeuronStructure(idPrefix, originX, originY) { 
            const nodes = [
                { id: `${idPrefix}_in1`, label: 'x₁', type: 'input', x: originX, y: originY - 60 },
                { id: `${idPrefix}_in2`, label: 'x₂', type: 'input', x: originX, y: originY },
                { id: `${idPrefix}_bias_in`, label: '1', type: 'bias', x: originX, y: originY + 60 }, 
                { id: `${idPrefix}_sum_node`, label: 'Σ', type: 'sum', x: originX + 120, y: originY },
                { id: `${idPrefix}_act_node`, label: 'σ', type: 'neuron', x: originX + 230, y: originY },
                { id: `${idPrefix}_out1`, label: 'a', type: 'output', x: originX + 310, y: originY }
            ];
            const connections = [
                { id: `${idPrefix}_c1`, from: `${idPrefix}_in1`, to: `${idPrefix}_sum_node`, label: 'w₁', arrow: true },
                { id: `${idPrefix}_c2`, from: `${idPrefix}_in2`, to: `${idPrefix}_sum_node`, label: 'w₂', arrow: true },
                { id: `${idPrefix}_c_bias`, from: `${idPrefix}_bias_in`, to: `${idPrefix}_sum_node`, label: 'b', arrow: true }, 
                { id: `${idPrefix}_c_sum_act`, from: `${idPrefix}_sum_node`, to: `${idPrefix}_act_node`, label: 'z', arrow: true },
                { id: `${idPrefix}_c_act_out`, from: `${idPrefix}_act_node`, to: `${idPrefix}_out1`, arrow: true }
            ];
            return { nodes, connections };
        }

        function generateLossMSEUnit(idPrefix, origin, inputs) {
            const nodeSpacingX = 100;
            const nodeSpacingY = 70;
            const nodes = [
                { id: `${idPrefix}_ypred`, label: inputs.yPredLabel, type: 'input', x: origin.x, y: origin.y },
                { id: `${idPrefix}_ytrue`, label: inputs.yTrueLabel, type: 'input', x: origin.x, y: origin.y + nodeSpacingY },
                { id: `${idPrefix}_subtract`, label: '-', type: 'sum', x: origin.x + nodeSpacingX, y: origin.y + nodeSpacingY / 2 },
                { id: `${idPrefix}_square`, label: 'x²', type: 'sum', x: origin.x + 2 * nodeSpacingX, y: origin.y + nodeSpacingY / 2 },
                { id: `${idPrefix}_loss`, label: 'L', type: 'output', x: origin.x + 3 * nodeSpacingX, y: origin.y + nodeSpacingY / 2 }
            ];
            const connections = [
                { id: `${idPrefix}_conn_ypred_sub`, from: `${idPrefix}_ypred`, to: `${idPrefix}_subtract`, label: inputs.yPredLabel, arrow: true },
                { id: `${idPrefix}_conn_ytrue_sub`, from: `${idPrefix}_ytrue`, to: `${idPrefix}_subtract`, label: inputs.yTrueLabel, arrow: true },
                { id: `${idPrefix}_conn_sub_sq`, from: `${idPrefix}_subtract`, to: `${idPrefix}_square`, label: 'error', arrow: true },
                { id: `${idPrefix}_conn_sq_loss`, from: `${idPrefix}_square`, to: `${idPrefix}_loss`, label: 'error²', arrow: true }
            ];
            return { nodes, connections };
        }

        function generateGradientUpdateUnit(idPrefix, origin, paramLabel = "W") {
            const nodeSpacingX = 100;
            const nodeSpacingY = 70;
            const nodes = [
                { id: `${idPrefix}_param_old`, label: `${paramLabel}_viejo`, type: 'input', x: origin.x, y: origin.y },
                { id: `${idPrefix}_grad`, label: `∂L/∂${paramLabel}`, type: 'grad', x: origin.x, y: origin.y + nodeSpacingY * 1.5 },
                { id: `${idPrefix}_eta`, label: 'η', type: 'input', x: origin.x + nodeSpacingX, y: origin.y + nodeSpacingY * 1.5 },
                { id: `${idPrefix}_multiply`, label: '×', type: 'sum', x: origin.x + nodeSpacingX * 0.8, y: origin.y + nodeSpacingY * 0.75 }, 
                { id: `${idPrefix}_subtract`, label: '-', type: 'sum', x: origin.x + nodeSpacingX * 1.6, y: origin.y }, 
                { id: `${idPrefix}_param_new`, label: `${paramLabel}_nuevo`, type: 'output', x: origin.x + nodeSpacingX * 2.4, y: origin.y } 
            ];
            const connections = [
                { id: `${idPrefix}_conn_grad_mult`, from: `${idPrefix}_grad`, to: `${idPrefix}_multiply`, arrow: true },
                { id: `${idPrefix}_conn_eta_mult`, from: `${idPrefix}_eta`, to: `${idPrefix}_multiply`, arrow: true },
                { id: `${idPrefix}_conn_mult_sub`, from: `${idPrefix}_multiply`, to: `${idPrefix}_subtract`, label: `Δ${paramLabel}`, arrow: true },
                { id: `${idPrefix}_conn_old_sub`, from: `${idPrefix}_param_old`, to: `${idPrefix}_subtract`, arrow: true },
                { id: `${idPrefix}_conn_sub_new`, from: `${idPrefix}_subtract`, to: `${idPrefix}_param_new`, arrow: true }
            ];
            return { nodes, connections };
        }

        function generateChainRuleStep(idPrefix, origin, fromLabel, toLabel, operationLabel) {
            const nodeSpacingX = 130;
            const nodes = [
                { id: `${idPrefix}_from`, label: fromLabel, type: 'sum', x: origin.x, y: origin.y }, 
                { id: `${idPrefix}_to`, label: toLabel, type: 'neuron', x: origin.x + nodeSpacingX, y: origin.y } 
            ];
            const connections = [
                { id: `${idPrefix}_conn`, from: `${idPrefix}_from`, to: `${idPrefix}_to`, label: operationLabel, arrow: true }
            ];
            return { nodes, connections };
        }
        
        function generateBackwardErrorPropagationUnit(idPrefix, origin, nextDeltaLabel, localActivationLabel, connectingWeightLabel) {
            const nodeSpacingX = 100;
            const nodeSpacingY = 80; 
            const nodes = [
                { id: `${idPrefix}_next_delta`, label: nextDeltaLabel, type: 'error', x: origin.x, y: origin.y },
                { id: `${idPrefix}_connecting_weight`, label: connectingWeightLabel, type: 'default', x: origin.x, y: origin.y + nodeSpacingY, style:{radius:12, fontSize:'8px'}}, 
                { id: `${idPrefix}_multiply_weight_delta`, label: '×', type: 'sum', x: origin.x + nodeSpacingX, y: origin.y + nodeSpacingY / 2 },
                { id: `${idPrefix}_local_act_deriv`, label: localActivationLabel, type: 'default', x: origin.x + nodeSpacingX, y: origin.y + nodeSpacingY * 1.5 , style:{radius:12, fontSize:'8px'}},
                { id: `${idPrefix}_current_delta`, label: `δ⁽ˡ⁾`, type: 'error', x: origin.x + nodeSpacingX * 2, y: origin.y + nodeSpacingY / 2 }
            ];
            const connections = [
                { id: `${idPrefix}_conn_delta_mult`, from: `${idPrefix}_next_delta`, to: `${idPrefix}_multiply_weight_delta`, arrow: true },
                { id: `${idPrefix}_conn_weight_mult`, from: `${idPrefix}_connecting_weight`, to: `${idPrefix}_multiply_weight_delta`, arrow: true },
                { id: `${idPrefix}_conn_mult_curr_delta`, from: `${idPrefix}_multiply_weight_delta`, to: `${idPrefix}_current_delta`, label: '⊙', arrow: true }, 
                { id: `${idPrefix}_conn_act_deriv_curr_delta`, from: `${idPrefix}_local_act_deriv`, to: `${idPrefix}_current_delta`, arrow: true}
            ];
            return { nodes, connections };
        }

        function generateGradientCalculationUnit(idPrefix, origin, errorNodeLabel, prevActivationNodeLabel, paramSymbol = "W") {
            const nodeSpacingX = 100;
            const nodeSpacingY = 70;
            const nodes = [
                { id: `${idPrefix}_error_signal`, label: errorNodeLabel, type: 'error', x: origin.x, y: origin.y + nodeSpacingY / 2 }
            ];
            const connections = [];

            if (paramSymbol === "W" || paramSymbol.startsWith("w") || paramSymbol.startsWith("W")) { 
                nodes.push({ id: `${idPrefix}_prev_activation`, label: prevActivationNodeLabel, type: 'neuron', x: origin.x, y: origin.y - nodeSpacingY / 2 });
                nodes.push({ id: `${idPrefix}_grad_param`, label: `∂L/∂${paramSymbol}`, type: 'grad', x: origin.x + nodeSpacingX, y: origin.y });
                
                connections.push({ id: `${idPrefix}_conn_err_grad`, from: `${idPrefix}_error_signal`, to: `${idPrefix}_grad_param`, label: ' ', arrow: true });
                connections.push({ id: `${idPrefix}_conn_act_grad`, from: `${idPrefix}_prev_activation`, to: `${idPrefix}_grad_param`, label: '(⋅)', arrow: true, labelOffset:-5 });
            } else { 
                nodes.push({ id: `${idPrefix}_grad_param`, label: `∂L/∂${paramSymbol}`, type: 'grad', x: origin.x + nodeSpacingX, y: origin.y + nodeSpacingY / 2 });
                connections.push({ id: `${idPrefix}_conn_err_grad`, from: `${idPrefix}_error_signal`, to: `${idPrefix}_grad_param`, label: ' ( = )', arrow: true });
            }
            return { nodes, connections };
        }
        // --- Fin Generadores ---

        // --- Modelo Analítico Central y Motor de Simulación ---
        class NeuralNetworkLayer {
            constructor(numNeurons, numInputsPerNeuron, activationType = 'sigmoid') {
                this.numNeurons = numNeurons;
                this.numInputsPerNeuron = numInputsPerNeuron;
                this.activationType = activationType;
                
                this.weights = []; 
                this.biases = new Array(numNeurons).fill(0);
                
                this.lastZ = new Array(numNeurons).fill(0);
                this.lastActivation = new Array(numNeurons).fill(0);
                this.delta = new Array(numNeurons).fill(0);
                
                this.weightGradients = []; 
                this.biasGradients = new Array(numNeurons).fill(0);

                this.initializeWeights();
            }

            initializeWeights(randomRange = 0.1) {
                this.weights = [];
                this.weightGradients = [];
                this.biases = new Array(this.numNeurons);
                this.biasGradients = new Array(this.numNeurons).fill(0);
                this.lastZ = new Array(this.numNeurons).fill(0);
                this.lastActivation = new Array(this.numNeurons).fill(0);
                this.delta = new Array(this.numNeurons).fill(0);

                for (let i = 0; i < this.numNeurons; i++) {
                    this.weights[i] = [];
                    this.weightGradients[i] = new Array(this.numInputsPerNeuron).fill(0);
                    for (let j = 0; j < this.numInputsPerNeuron; j++) {
                        this.weights[i][j] = (Math.random() * 2 - 1) * randomRange;
                    }
                    this.biases[i] = (Math.random() * 2 - 1) * randomRange;
                }
            }

            sigmoid(z) {
                if (Array.isArray(z)) { 
                    return z.map(val => 1 / (1 + Math.exp(-val)));
                }
                return 1 / (1 + Math.exp(-z));
            }

            sigmoidDerivative(a) { 
                if (Array.isArray(a)) { 
                    return a.map(val => val * (1 - val));
                }
                // Heuristic to check if z was passed instead of a for sigmoid
                if (this.activationType === 'sigmoid' && (a < 0 || a > 1) && (Math.abs(a) > 1e-3)) { 
                    const activationVal = this.sigmoid(a);
                    return activationVal * (1 - activationVal);
                }
                return a * (1 - a);
            }
            
            forwardPass(inputVector) {
                if (inputVector.length !== this.numInputsPerNeuron) {
                    console.error(`Layer forwardPass: inputVector length (${inputVector.length}) does not match numInputsPerNeuron (${this.numInputsPerNeuron}) for layer with ${this.numNeurons} neurons.`);
                    return new Array(this.numNeurons).fill(0);
                }

                for (let j = 0; j < this.numNeurons; j++) {
                    let z_j = 0;
                    for (let i = 0; i < this.numInputsPerNeuron; i++) {
                        z_j += this.weights[j][i] * inputVector[i];
                    }
                    z_j += this.biases[j];
                    this.lastZ[j] = z_j;
                    
                    if (this.activationType === 'sigmoid') {
                        this.lastActivation[j] = this.sigmoid(z_j);
                    } else if (this.activationType === 'linear') {
                        this.lastActivation[j] = z_j; 
                    } else { 
                        this.lastActivation[j] = this.sigmoid(z_j); // Default to sigmoid
                    }
                }
                return [...this.lastActivation]; 
            }
        }

        class NeuralNetworkModel {
            constructor(layerConfigs) {
                this.layers = [];
                for (const config of layerConfigs) {
                    this.layers.push(new NeuralNetworkLayer(config.numNeurons, config.numInputs, config.activation));
                }
            }

            initialize() {
                for (const layer of this.layers) {
                    layer.initializeWeights();
                }
            }

            predict(inputVector) {
                let currentActivation = [...inputVector];
                for (const layer of this.layers) {
                    currentActivation = layer.forwardPass(currentActivation);
                }
                return currentActivation;
            }
        }

        class MeanSquaredErrorLoss {
            loss(predictedOutputVector, targetOutputVector) {
                if (predictedOutputVector.length !== targetOutputVector.length || predictedOutputVector.length === 0) {
                    console.error("MSE Loss: Vector lengths mismatch or empty vectors.");
                    return 0;
                }
                let sumSquaredError = 0;
                for (let i = 0; i < predictedOutputVector.length; i++) {
                    sumSquaredError += Math.pow(predictedOutputVector[i] - targetOutputVector[i], 2);
                }
                return 0.5 * sumSquaredError / predictedOutputVector.length; 
            }

            derivative(predictedOutputVector, targetOutputVector) {
                if (predictedOutputVector.length !== targetOutputVector.length || predictedOutputVector.length === 0) {
                    console.error("MSE Derivative: Vector lengths mismatch or empty vectors.");
                    return new Array(predictedOutputVector.length).fill(0);
                }
                const derivative = [];
                for (let i = 0; i < predictedOutputVector.length; i++) {
                    derivative[i] = (predictedOutputVector[i] - targetOutputVector[i]) / predictedOutputVector.length;
                }
                return derivative;
            }
        }
        
        class BackpropagationSimulator {
            constructor(networkModel, lossFunction) {
                this.networkModel = networkModel;
                this.lossFunction = lossFunction;
                this.currentAlgorithmStep = "idle"; 
                this.lastInput = [];
                this.lastTarget = [];
            }

            performFullForwardPass(inputVector) {
                this.lastInput = [...inputVector]; 
                let currentActivation = [...inputVector];
                for (let i = 0; i < this.networkModel.layers.length; i++) {
                    currentActivation = this.networkModel.layers[i].forwardPass(currentActivation);
                }
                return currentActivation;
            }

            calculateOverallLoss(predictedOutput, targetOutputVector) {
                this.lastTarget = [...targetOutputVector];
                return this.lossFunction.loss(predictedOutput, targetOutputVector);
            }

            calculateOutputLayerDelta() {
                const outputLayer = this.networkModel.layers[this.networkModel.layers.length - 1];
                const lossDerivative = this.lossFunction.derivative(outputLayer.lastActivation, this.lastTarget);
                
                const sigmaDerivatives = outputLayer.lastActivation.map(a => outputLayer.sigmoidDerivative(a));

                outputLayer.delta = lossDerivative.map((ld, i) => ld * sigmaDerivatives[i]);
            }

            calculateHiddenLayerDelta(layerIndex) {
                const layerL = this.networkModel.layers[layerIndex];
                const layerLplus1 = this.networkModel.layers[layerIndex + 1];
                
                layerL.delta = new Array(layerL.numNeurons).fill(0);

                for (let j = 0; j < layerL.numNeurons; j++) { 
                    let sumWeightedDeltas = 0;
                    for (let k = 0; k < layerLplus1.numNeurons; k++) { 
                        sumWeightedDeltas += layerLplus1.weights[k][j] * layerLplus1.delta[k];
                    }
                    const sigmaDerivative = layerL.sigmoidDerivative(layerL.lastActivation[j]);
                    layerL.delta[j] = sumWeightedDeltas * sigmaDerivative;
                }
            }

            calculateGradientsForLayer(layerIndex) {
                const currentLayer = this.networkModel.layers[layerIndex];
                const prevLayerActivation = (layerIndex === 0) ? this.lastInput : this.networkModel.layers[layerIndex - 1].lastActivation;

                if (prevLayerActivation.length !== currentLayer.numInputsPerNeuron) {
                     console.error(`Gradient calc for layer ${layerIndex}: prevLayerActivation length (${prevLayerActivation.length}) mismatch with numInputsPerNeuron (${currentLayer.numInputsPerNeuron})`);
                     return;
                }

                for (let j = 0; j < currentLayer.numNeurons; j++) {
                    for (let i = 0; i < currentLayer.numInputsPerNeuron; i++) {
                        currentLayer.weightGradients[j][i] = currentLayer.delta[j] * prevLayerActivation[i];
                    }
                    currentLayer.biasGradients[j] = currentLayer.delta[j]; 
                }
            }

            updateWeightsForLayer(layerIndex, learningRate) {
                const layer = this.networkModel.layers[layerIndex];
                for (let j = 0; j < layer.numNeurons; j++) {
                    for (let i = 0; i < layer.numInputsPerNeuron; i++) {
                        layer.weights[j][i] -= learningRate * layer.weightGradients[j][i];
                    }
                    layer.biases[j] -= learningRate * layer.biasGradients[j];
                }
            }
            
            trainSingleEpoch(inputVectors, targetOutputVectors, learningRate) {
                let totalEpochLoss = 0;
                if (inputVectors.length !== targetOutputVectors.length) {
                    console.error("Training data mismatch: input and target vector arrays must have the same length.");
                    return 0;
                }

                for (let i = 0; i < inputVectors.length; i++) {
                    const inputVector = inputVectors[i];
                    const targetOutputVector = targetOutputVectors[i];
                    
                    this.lastInput = [...inputVector]; 
                    this.lastTarget = [...targetOutputVector];

                    const output = this.performFullForwardPass(inputVector);
                    totalEpochLoss += this.lossFunction.loss(output, targetOutputVector);
                    
                    this.calculateOutputLayerDelta();

                    for (let l = this.networkModel.layers.length - 2; l >= 0; l--) {
                        this.calculateHiddenLayerDelta(l);
                    }
                    for (let l = this.networkModel.layers.length - 1; l >= 0; l--) {
                        this.calculateGradientsForLayer(l);
                    }
                    for (let l = 0; l < this.networkModel.layers.length; l++) { 
                        this.updateWeightsForLayer(l, learningRate);
                    }
                }
                return totalEpochLoss / inputVectors.length; 
            }
        }
        // --- Fin Modelo Analítico y Motor de Simulación ---


        class InteractiveDiagram {
            constructor(svgContainerId, diagramData) {
                this.container = document.getElementById(svgContainerId);
                if (!this.container) {
                    console.error(`Contenedor de diagrama SVG con ID ${svgContainerId} no encontrado.`);
                    return;
                }
                this.diagramData = diagramData; 
                this.svg = null; 
                this.currentStateIndex = 0;
                this.stateDescriptionElement = this.container.parentElement.querySelector('.diagram-state-description');
                this.showFormulas = GlobalShowFormulaAnnotations; 

                this.viewBox = { x: 0, y: 0, width: 400, height: 300 }; 
                if (diagramData.viewBox) {
                    const vbParts = diagramData.viewBox.split(' ').map(Number);
                    if (vbParts.length === 4) {
                        this.viewBox = { x: vbParts[0], y: vbParts[1], width: vbParts[2], height: vbParts[3] };
                    }
                }
                
                this.isPanning = false;
                this.lastPanPoint = { x: 0, y: 0 };

                this.render();
                this.enableInteractions();
                this.updateStateControls();
            }

            getNodeStyle(node) {
                const template = { ...nodeTemplates.default, ...(nodeTemplates[node.type] || {}) };
                return { ...template, ...(node.style || {}) }; 
            }

            getConnectionStyle(conn, isHighlighted) {
                let template = { ...connectionTemplates.default };
                if (isHighlighted) {
                    template = { ...template, ...connectionTemplates.highlighted };
                }
                if (conn.dashed) {
                    template = { ...template, ...connectionTemplates.dashed };
                }
                if (conn.type === 'errorFlow') { 
                     template = { ...template, ...connectionTemplates.errorFlow };
                }
                return { ...template, ...(conn.style || {}) }; 
            }


            render() {
                this.container.innerHTML = ''; 
                this.svg = createSvgElementUtility('svg', {
                    viewBox: `${this.viewBox.x} ${this.viewBox.y} ${this.viewBox.width} ${this.viewBox.height}`,
                    preserveAspectRatio: "xMidYMid meet"
                });
                this.container.appendChild(this.svg);
                this.container.__interactiveDiagramInstance = this; 

                let displayData = this.diagramData;
                let highlightedNodeIds = new Set();
                let highlightedConnectionIds = new Set();
                let formulaAnnotations = [];

                if (this.diagramData.states && this.diagramData.states.length > 0) {
                    const currentState = this.diagramData.states[this.currentStateIndex];

                    if (currentState.modifiesPreviousState === true && this.currentStateIndex > 0) {
                        const previousState = this.diagramData.states[this.currentStateIndex - 1];
                        
                        if (previousState.highlightedNodes) {
                            previousState.highlightedNodes.forEach(id => highlightedNodeIds.add(id));
                        }
                        if (previousState.highlightedConnections) {
                            previousState.highlightedConnections.forEach(id => highlightedConnectionIds.add(id));
                        }
                        
                        if (currentState.addHighlightedNodes) {
                            currentState.addHighlightedNodes.forEach(id => highlightedNodeIds.add(id));
                        }
                        if (currentState.removeHighlightedNodes) {
                            currentState.removeHighlightedNodes.forEach(id => highlightedNodeIds.delete(id));
                        }
                        if (currentState.addHighlightedConnections) {
                            currentState.addHighlightedConnections.forEach(id => highlightedConnectionIds.add(id));
                        }
                        if (currentState.removeHighlightedConnections) {
                            currentState.removeHighlightedConnections.forEach(id => highlightedConnectionIds.delete(id));
                        }
                    } else {
                        highlightedNodeIds = new Set(currentState.highlightedNodes || []);
                        highlightedConnectionIds = new Set(currentState.highlightedConnections || []);
                    }
                    
                    if (this.stateDescriptionElement && currentState.description) {
                        this.stateDescriptionElement.textContent = currentState.description;
                    } else if (this.stateDescriptionElement) {
                        this.stateDescriptionElement.textContent = '';
                    }
                    if (this.showFormulas && currentState.formulaAnnotations) {
                        formulaAnnotations = currentState.formulaAnnotations;
                    }
                }
                
                const hasArrows = displayData.connections.some(c => c.arrow);
                if (hasArrows && !this.svg.querySelector('#arrowhead')) {
                    const defs = createSvgElementUtility('defs', {});
                    const marker = createSvgElementUtility('marker', {
                        id: 'arrowhead', markerWidth: '5', markerHeight: '3.5',
                        refX: '5', refY: '1.75', orient: 'auto'
                    });
                    marker.appendChild(createSvgElementUtility('polygon', { points: '0 0, 5 1.75, 0 3.5', fill: connectionTemplates.default.stroke }));
                    defs.appendChild(marker);
                    this.svg.insertBefore(defs, this.svg.firstChild);
                }
                if (hasArrows && !this.svg.querySelector('#arrowhead-highlight')) {
                     const defs = this.svg.querySelector('defs') || createSvgElementUtility('defs', {});
                     const markerHighlight = createSvgElementUtility('marker', {
                        id: 'arrowhead-highlight', markerWidth: '6', markerHeight: '4.2',
                        refX: '6', refY: '2.1', orient: 'auto'
                    });
                    markerHighlight.appendChild(createSvgElementUtility('polygon', { points: '0 0, 6 2.1, 0 4.2', fill: connectionTemplates.highlighted.stroke }));
                    defs.appendChild(markerHighlight);
                    if (!this.svg.querySelector('defs')) this.svg.insertBefore(defs, this.svg.firstChild);
                }

                displayData.connections.forEach(conn => {
                    const fromNode = displayData.nodes.find(n => n.id === conn.from);
                    const toNode = displayData.nodes.find(n => n.id === conn.to);
                    if (fromNode && toNode) {
                        const isHighlighted = highlightedConnectionIds.has(conn.id);
                        const style = this.getConnectionStyle(conn, isHighlighted);
                        
                        const lineAttrs = {
                            x1: fromNode.x, y1: fromNode.y, x2: toNode.x, y2: toNode.y,
                            stroke: style.stroke, 'stroke-width': style['stroke-width'],
                            opacity: (this.diagramData.states && !isHighlighted && highlightedConnectionIds.size > 0 && highlightedConnectionIds.size !== displayData.connections.length) ? 0.3 : 1,
                        };
                        if (style['stroke-dasharray']) lineAttrs['stroke-dasharray'] = style['stroke-dasharray'];
                        if (conn.arrow) lineAttrs['marker-end'] = isHighlighted ? 'url(#arrowhead-highlight)' : 'url(#arrowhead)';
                        
                        const line = createSvgElementUtility('line', lineAttrs);
                        this.svg.appendChild(line);

                        if (conn.label) {
                            const midX = (fromNode.x + toNode.x) / 2;
                            const midY = (fromNode.y + toNode.y) / 2;
                            const text = createSvgElementUtility('text', {
                                x: midX, y: midY - (conn.labelOffset || 5), 
                                'text-anchor': 'middle', 'font-size': style.labelFontSize,
                                fill: style.labelFill, 'paint-order': 'stroke', stroke: '#fdfdfd',
                                'stroke-width': '0.2em', 'stroke-linejoin': 'round',
                                opacity: (this.diagramData.states && !isHighlighted && highlightedConnectionIds.size > 0 && highlightedConnectionIds.size !== displayData.connections.length) ? 0.5 : 1,
                                'font-weight': isHighlighted ? '600' : 'normal'
                            });
                            text.textContent = conn.label;
                            this.svg.appendChild(text);
                        }
                    }
                });
                
                displayData.nodes.forEach(node => {
                    const isHighlighted = highlightedNodeIds.has(node.id);
                    const style = this.getNodeStyle(node);

                    const circle = createSvgElementUtility('circle', {
                        cx: node.x, cy: node.y, r: node.radius || style.radius,
                        fill: isHighlighted ? style.stroke : style.fill, 
                        stroke: style.stroke, 'stroke-width': isHighlighted ? 2.5 : style['stroke-width'],
                        opacity: (this.diagramData.states && !isHighlighted && highlightedNodeIds.size > 0 && highlightedNodeIds.size !== displayData.nodes.length) ? 0.4 : 1
                    });
                    this.svg.appendChild(circle);
                    
                    const text = createSvgElementUtility('text', {
                        x: node.x, y: node.y, 'text-anchor': 'middle', 'dominant-baseline': 'central',
                        'font-size': style.fontSize, fill: isHighlighted ? 'white' : style.textColor,
                        'font-weight': isHighlighted ? 'bold' : 'normal',
                         opacity: (this.diagramData.states && !isHighlighted && highlightedNodeIds.size > 0 && highlightedNodeIds.size !== displayData.nodes.length) ? 0.6 : 1
                    });
                    text.textContent = node.label;
                    this.svg.appendChild(text);
                });

                if (this.showFormulas) {
                    formulaAnnotations.forEach(annotation => {
                        let annX = annotation.x || 0;
                        let annY = annotation.y || 0;
                        const targetNode = displayData.nodes.find(n => n.id === annotation.elementId);

                        if (targetNode) {
                            const nodeStyle = this.getNodeStyle(targetNode);
                            const radius = targetNode.radius || nodeStyle.radius;
                            switch(annotation.position) {
                                case 'top': annX = targetNode.x; annY = targetNode.y - radius - 5; break;
                                case 'bottom': annX = targetNode.x; annY = targetNode.y + radius + 10; break;
                                case 'left': annX = targetNode.x - radius - 5; annY = targetNode.y; break;
                                case 'right': annX = targetNode.x + radius + 5; annY = targetNode.y; break;
                                default: 
                                    if(annotation.x === undefined) annX = targetNode.x + (radius * 0.7);
                                    if(annotation.y === undefined) annY = targetNode.y - (radius * 0.7);
                            }
                        }
                        annX += (annotation.dx || 0);
                        annY += (annotation.dy || 0);

                        const formulaText = createSvgElementUtility('text', {
                            x: annX, y: annY,
                            'text-anchor': (annotation.position === 'left' ? 'end' : (annotation.position === 'right' ? 'start' : 'middle')),
                            'dominant-baseline': (annotation.position === 'top' ? 'alphabetic' : (annotation.position === 'bottom' ? 'hanging' : 'central')),
                            class: 'formula-annotation' 
                        });
                        formulaText.textContent = annotation.text;
                        this.svg.appendChild(formulaText);
                    });
                }

                const titleTextContent = (this.diagramData.states && this.diagramData.states[this.currentStateIndex]?.title) ? 
                                          this.diagramData.states[this.currentStateIndex].title : 
                                          this.diagramData.title;
                if (titleTextContent) {
                    const titleText = createSvgElementUtility('text', {
                        x: this.viewBox.x + this.viewBox.width / 2, 
                        y: this.viewBox.y + 20, 
                        'text-anchor': 'middle', 'font-size': '14px',
                        'font-weight': 'bold', fill: '#007bff'
                    });
                    titleText.textContent = titleTextContent;
                    this.svg.appendChild(titleText);
                }
            }

            updateViewBox() { 
                if (this.svg) {
                    this.svg.setAttribute('viewBox', `${this.viewBox.x} ${this.viewBox.y} ${this.viewBox.width} ${this.viewBox.height}`);
                }
            }

            nextState() {
                if (this.diagramData.states && this.currentStateIndex < this.diagramData.states.length - 1) {
                    this.currentStateIndex++;
                    this.render();
                    this.updateStateControls();
                }
            }

            prevState() {
                if (this.diagramData.states && this.currentStateIndex > 0) {
                    this.currentStateIndex--;
                    this.render();
                    this.updateStateControls();
                }
            }
            
            updateStateControls() {
                const parent = this.container.parentElement;
                const prevBtn = parent.querySelector('.diagram-prev-btn');
                const nextBtn = parent.querySelector('.diagram-next-btn');

                if (prevBtn && nextBtn && this.diagramData.states) {
                    prevBtn.disabled = this.currentStateIndex === 0;
                    nextBtn.disabled = this.currentStateIndex === this.diagramData.states.length - 1;
                }
            }

            enableInteractions() {
                if (!this.svg) return;
                this.svg.addEventListener('wheel', (event) => {
                    event.preventDefault();
                    const zoomFactor = 1.1;
                    const svgRect = this.svg.getBoundingClientRect();
                    const mouseX = event.clientX - svgRect.left;
                    const mouseY = event.clientY - svgRect.top;
                    const pointX = this.viewBox.x + (mouseX / svgRect.width) * this.viewBox.width;
                    const pointY = this.viewBox.y + (mouseY / svgRect.height) * this.viewBox.height;

                    if (event.deltaY < 0) { 
                        this.viewBox.width /= zoomFactor; this.viewBox.height /= zoomFactor;
                    } else { 
                        this.viewBox.width *= zoomFactor; this.viewBox.height *= zoomFactor;
                    }
                    this.viewBox.x = pointX - (mouseX / svgRect.width) * this.viewBox.width;
                    this.viewBox.y = pointY - (mouseY / svgRect.height) * this.viewBox.height;
                    this.updateViewBox();
                });
                this.svg.addEventListener('mousedown', (event) => {
                    if (event.button === 0) { 
                        this.isPanning = true; this.svg.style.cursor = 'grabbing';
                        this.lastPanPoint.x = event.clientX; 
                        this.lastPanPoint.y = event.clientY;
                    }
                });
                this.svg.addEventListener('mousemove', (event) => {
                    if (this.isPanning) {
                        const svgRect = this.svg.getBoundingClientRect();
                        const dx = (event.clientX - this.lastPanPoint.x) * (this.viewBox.width / svgRect.width);
                        const dy = (event.clientY - this.lastPanPoint.y) * (this.viewBox.height / svgRect.height);
                        this.viewBox.x -= dx;
                        this.viewBox.y -= dy;
                        this.lastPanPoint.x = event.clientX;
                        this.lastPanPoint.y = event.clientY;
                        this.updateViewBox();
                    }
                });
                const stopPanning = () => {
                    if (this.isPanning) {
                        this.isPanning = false; this.svg.style.cursor = 'grab';
                    }
                };
                this.svg.addEventListener('mouseup', stopPanning);
                this.svg.addEventListener('mouseleave', stopPanning);
            }
        }
        
        // Pre-generate structures
        const s1_detailedNeuronStructure = generateDetailedNeuronStructure('s1_neuron', 50, 110);
        const s2_lossMSEUnit = generateLossMSEUnit('s2_mse', {x: 30, y: 80}, { yPredLabel: 'ŷ', yTrueLabel: 'y' });
        const s3_gradUpdateUnit = generateGradientUpdateUnit('s3_gd', {x: 50, y: 100}, 'W');
        const s8_gradUpdateUnit = generateGradientUpdateUnit('s8_upd', {x: 50, y: 100}, 'W');

        const subtopicsData = [ 
            { // Subtopic 1: Redes y Aprendizaje (Uses generateDetailedNeuronStructure)
                title: "1. Redes y Aprendizaje",
                content: `
                    <h3>1. Introducción a las Redes Neuronales y la Necesidad de Aprender</h3>
                    <p>Una red neuronal es un modelo computacional inspirado en la estructura y función del cerebro humano. Consiste en unidades interconectadas llamadas <strong class='text-blue-600'>neuronas</strong>, organizadas en <strong class='text-blue-600'>capas</strong> (entrada, ocultas, salida).</p>
                    <p>El <strong class='text-blue-600'>aprendizaje</strong> en una red neuronal implica ajustar los <strong class='text-blue-600'>pesos</strong> (fuerza de las conexiones) y <strong class='text-blue-600'>sesgos</strong> (biases) de estas neuronas para que la red pueda realizar una tarea específica.</p>
                    <p>Cada neurona calcula una suma ponderada de sus entradas, le añade un sesgo, y luego pasa el resultado a través de una <strong class='text-blue-600'>función de activación</strong> no lineal.</p>
                    <div class="math-formula">Suma ponderada: $z = \sum_{i} w_i x_i + b$</div>
                    <div class="math-formula">Activación: $a = \sigma(z)$</div>
                    <p class="text-sm text-gray-600">Diagrama interactivo (use los botones para ver los pasos):</p>
                `,
                diagramDefinition: { 
                    title: "Neurona Detallada",
                    viewBox: "0 0 400 230", 
                    nodes: s1_detailedNeuronStructure.nodes, 
                    connections: s1_detailedNeuronStructure.connections, 
                    states: [
                        { 
                            description: "Entradas (x₁, x₂) y pesos (w₁, w₂).",
                            highlightedNodes: [`s1_neuron_in1`, `s1_neuron_in2`],
                            highlightedConnections: [`s1_neuron_c1`, `s1_neuron_c2`],
                            formulaAnnotations: [
                                { elementId: `s1_neuron_in1`, text: "x₁", position: 'left', dx: -5},
                                { elementId: `s1_neuron_in2`, text: "x₂", position: 'left', dx: -5},
                            ]
                        },
                        { // State 2 (index 1) - Incremental
                            description: "El sesgo (b) también es una entrada ponderada (peso b, entrada 1).",
                            modifiesPreviousState: true,
                            addHighlightedNodes: [`s1_neuron_bias_in`, `s1_neuron_sum_node`],
                            removeHighlightedNodes: [`s1_neuron_in1`, `s1_neuron_in2`],
                            addHighlightedConnections: [`s1_neuron_c_bias`],
                            removeHighlightedConnections: [`s1_neuron_c1`, `s1_neuron_c2`],
                            formulaAnnotations: [
                                { elementId: `s1_neuron_bias_in`, text: "1 (bias input)", position: 'left', dx: -5},
                                { elementId: `s1_neuron_c_bias`, text: "b", position: 'bottom', dy: 5},
                            ]
                        },
                        { // State 3 (index 2) - Incremental
                            description: "Suma ponderada: z = w₁x₁ + w₂x₂ + b.",
                            modifiesPreviousState: true, 
                            addHighlightedNodes: [`s1_neuron_in1`, `s1_neuron_in2`], 
                            addHighlightedConnections: [`s1_neuron_c1`, `s1_neuron_c2`, `s1_neuron_c_sum_act`], 
                            formulaAnnotations: [
                                { elementId: `s1_neuron_sum_node`, text: "z", position: 'right', dx: 5},
                            ]
                        },
                        { // State 4 (index 3) - Not incremental
                            description: "Función de activación: a = σ(z).",
                            highlightedNodes: [`s1_neuron_sum_node`, `s1_neuron_act_node`, `s1_neuron_out1`],
                            highlightedConnections: [`s1_neuron_c_sum_act`, `s1_neuron_c_act_out`],
                             formulaAnnotations: [
                                { elementId: `s1_neuron_act_node`, text: "a = σ(z)", position: 'bottom', dy: 10},
                            ]
                        }
                    ]
                }
            },
            { // Subtopic 2: Función de Pérdida (Uses generateLossMSEUnit)
                title: "2. Función de Pérdida",
                content: `
                    <h3>2. La Función de Pérdida (Costo): Midiendo el Error</h3>
                    <p>Para que una red aprenda, necesitamos una forma de medir qué tan bien (o mal) está realizando su tarea. Esto se hace mediante una <strong class='text-blue-600'>función de pérdida</strong> (o función de costo).</p>
                    <p>La función de pérdida compara las predicciones de la red ($y_{pred}$) con los valores verdaderos ($y_{true}$) y devuelve un número que representa el error. El objetivo del entrenamiento es minimizar este valor.</p>
                    <p>Ejemplos comunes:</p>
                    <ul class='list-disc list-inside ml-4'>
                        <li><strong class='text-gray-700'>Error Cuadrático Medio (MSE):</strong> Usado comúnmente en problemas de regresión.
                            <div class="math-formula">MSE: $L(y_{true}, y_{pred}) = \\frac{1}{N} \\sum_{i=1}^{N} (y_{true,i} - y_{pred,i})^2$</div>
                        </li>
                        <li><strong class='text-gray-700'>Entropía Cruzada (Cross-Entropy):</strong> Usada comúnmente en problemas de clasificación.
                            <div class="math-formula">Entropía Cruzada (binaria): $L = -[y_{true} \\log(y_{pred}) + (1-y_{true}) \\log(1-y_{pred})]$</div>
                        </li>
                    </ul>
                    <p class="text-sm text-gray-600">Diagrama interactivo (MSE para un dato):</p>
                `,
                diagramDefinition: {
                    title: "Función de Pérdida (MSE - un dato)",
                    viewBox: "0 0 450 250", 
                    nodes: s2_lossMSEUnit.nodes,
                    connections: s2_lossMSEUnit.connections,
                    states: [
                        { 
                            description: "Entradas: predicción (ŷ) y valor real (y).",
                            highlightedNodes: ['s2_mse_ypred', 's2_mse_ytrue'], 
                            highlightedConnections: [],
                            formulaAnnotations: [
                                {elementId: 's2_mse_ypred', text: "ŷ", position: 'top'},
                                {elementId: 's2_mse_ytrue', text: "y", position: 'bottom'}
                            ]
                        },
                        { 
                            description: "Cálculo de la diferencia (error): y - ŷ.",
                            modifiesPreviousState: true,
                            addHighlightedNodes: ['s2_mse_subtract'],
                            addHighlightedConnections: ['s2_mse_conn_ypred_sub', 's2_mse_conn_ytrue_sub', 's2_mse_conn_sub_sq'],
                            formulaAnnotations: [
                                {elementId: 's2_mse_subtract', text: "e = y - ŷ", position: 'bottom', dy: 10}
                            ]
                        },
                        { 
                            description: "Cálculo del error al cuadrado: (y - ŷ)². (Para MSE, usualmente se promedia sobre N muestras).",
                            modifiesPreviousState: true,
                            addHighlightedNodes: ['s2_mse_square', 's2_mse_loss'],
                            removeHighlightedNodes: ['s2_mse_ypred', 's2_mse_ytrue'], 
                            addHighlightedConnections: ['s2_mse_conn_sq_loss'],
                            removeHighlightedConnections: ['s2_mse_conn_ypred_sub', 's2_mse_conn_ytrue_sub'], 
                            formulaAnnotations: [
                                {elementId: 's2_mse_square', text: "e²", position: 'bottom', dy: 10},
                                {elementId: 's2_mse_loss', text: "L = ½e² (o e²)", position: 'top'}
                            ]
                        }
                    ]
                }
            },
             { // Subtopic 3: Descenso del Gradiente (Uses generateGradientUpdateUnit)
                title: "3. Descenso del Gradiente",
                 content: `
                    <h3>3. Optimización: El Descenso del Gradiente</h3>
                    <p>El <strong class='text-blue-600'>descenso del gradiente</strong> es el algoritmo de optimización más común para entrenar redes neuronales. Su objetivo es encontrar los valores de los pesos y sesgos que minimizan la función de pérdida.</p>
                    <p>Imagina la función de pérdida como un paisaje montañoso. El descenso del gradiente intenta encontrar el valle más profundo (el mínimo de la función). Lo hace calculando el <strong class='text-blue-600'>gradiente</strong> (la dirección de mayor inclinación) de la función de pérdida con respecto a cada parámetro (peso o sesgo) y luego dando un pequeño paso en la dirección opuesta.</p>
                    <p>La <strong class='text-blue-600'>tasa de aprendizaje ($\eta$)</strong> controla el tamaño de estos pasos.</p>
                    <div class="math-formula">Actualización de un peso $w$: $w_{nuevo} = w_{viejo} - \\eta \\frac{\\partial L}{\\partial w}$</div>
                    <p class="text-sm text-gray-600">Diagrama interactivo:</p>
                `,
                diagramDefinition: { 
                    title: "Descenso del Gradiente (Actualización)",
                    viewBox: "0 0 500 280", 
                    nodes: s3_gradUpdateUnit.nodes,
                    connections: s3_gradUpdateUnit.connections,
                    states: [
                        { 
                            description: "Componentes: Peso actual (W_viejo), gradiente (∂L/∂W), tasa de aprendizaje (η).",
                            highlightedNodes: ['s3_gd_param_old', 's3_gd_grad', 's3_gd_eta'],
                            highlightedConnections: [],
                            formulaAnnotations: [
                                {elementId: 's3_gd_param_old', text: "W_t", position: 'top'},
                                {elementId: 's3_gd_grad', text: "∇L(W_t)", position: 'bottom'},
                                {elementId: 's3_gd_eta', text: "η", position: 'bottom'}
                            ]
                        },
                        { 
                            description: "Cálculo del cambio: ΔW = η * ∂L/∂W.",
                            modifiesPreviousState: true,
                            addHighlightedNodes: ['s3_gd_multiply'],
                            addHighlightedConnections: ['s3_gd_conn_grad_mult', 's3_gd_conn_eta_mult', 's3_gd_conn_mult_sub'],
                             formulaAnnotations: [
                                {elementId: 's3_gd_multiply', text: "η∇L(W_t)", position: 'right', dx:10}
                            ]
                        },
                        { 
                            description: "Actualización del peso: W_nuevo = W_viejo - ΔW.",
                            modifiesPreviousState: true,
                            addHighlightedNodes: ['s3_gd_subtract', 's3_gd_param_new'],
                            addHighlightedConnections: ['s3_gd_conn_old_sub', 's3_gd_conn_sub_new'],
                            formulaAnnotations: [
                                {elementId: 's3_gd_param_new', text: "W_t+1", position: 'top'}
                            ]
                        }
                    ]
                }
            },
            { 
                title: "4. Regla de la Cadena",
                content: `
                    <h3>4. La Regla de la Cadena: La Base Matemática</h3>
                    <p>Las redes neuronales son esencialmente funciones compuestas muy grandes. La salida de una neurona es la entrada de otra, y la función de pérdida depende de la salida final de la red. Para calcular cómo un cambio en un peso en una capa temprana afecta la pérdida final, necesitamos la <strong class='text-blue-600'>regla de la cadena</strong> del cálculo diferencial.</p>
                    <p>La regla de la cadena nos dice cómo calcular la derivada de una función compuesta. Si tenemos $y = f(u)$ y $u = g(x)$, entonces la derivada de $y$ con respecto a $x$ es:</p>
                    <div class="math-formula">$\\frac{dy}{dx} = \\frac{dy}{du} \\cdot \\frac{du}{dx}$</div>
                    <p>En una red neuronal, la pérdida $L$ es una función de las activaciones de la capa de salida ($a^L$), que son funciones de las sumas ponderadas ($z^L$), que a su vez son funciones de las activaciones de capas anteriores ($a^{L-1}$) y los pesos ($W^L$). La retropropagación aplica sistemáticamente la regla de la cadena.</p>
                    <p class="text-sm text-gray-600">Diagrama interactivo (derivada de $L$ respecto a $W$):</p>
                `,
                diagramDefinition: { 
                    title: "Regla de la Cadena: ∂L/∂W",
                    viewBox: "0 0 550 200",
                    nodes: [ 
                        { id: 's4_W_rc', label: 'W', type: 'input', x: 50, y: 100 },
                        { id: 's4_z_rc', label: 'z', type: 'sum', x: 180, y: 100 }, 
                        { id: 's4_a_rc', label: 'a', type: 'neuron', x: 310, y: 100 }, 
                        { id: 's4_L_rc', label: 'L', type: 'output', x: 440, y: 100 }  
                    ],
                    connections: [
                        { id: 's4_c_Wz_rc', from: 's4_W_rc', to: 's4_z_rc', label: '∂z/∂W', arrow: true, labelOffset: -10 },
                        { id: 's4_c_za_rc', from: 's4_z_rc', to: 's4_a_rc', label: '∂a/∂z', arrow: true, labelOffset: -10 },
                        { id: 's4_c_aL_rc', from: 's4_a_rc', to: 's4_L_rc', label: '∂L/∂a', arrow: true, labelOffset: -10 }
                    ],
                    states: [
                        { 
                            description: "Paso 1: ∂L/∂a (derivada de la pérdida respecto a la activación 'a')", 
                            highlightedNodes: ['s4_a_rc', 's4_L_rc'], highlightedConnections: ['s4_c_aL_rc'],
                            formulaAnnotations: [{elementId: 's4_c_aL_rc', text: "∂L/∂a", position: 'bottom', dy: 5}]
                        },
                        { 
                            description: "Paso 2: (∂L/∂a) ⋅ (∂a/∂z) (se multiplica por la derivada de 'a' respecto a 'z')", 
                            highlightedNodes: ['s4_z_rc', 's4_a_rc', 's4_L_rc'], highlightedConnections: ['s4_c_za_rc', 's4_c_aL_rc'],
                            formulaAnnotations: [
                                {elementId: 's4_c_aL_rc', text: "∂L/∂a", position: 'bottom', dy: 5},
                                {elementId: 's4_c_za_rc', text: "∂a/∂z", position: 'bottom', dy: 5}
                            ]
                        },
                        { 
                            description: "Paso 3: (∂L/∂a) ⋅ (∂a/∂z) ⋅ (∂z/∂W) = ∂L/∂W", 
                            highlightedNodes: ['s4_W_rc','s4_z_rc', 's4_a_rc', 's4_L_rc'], highlightedConnections: ['s4_c_Wz_rc', 's4_c_za_rc', 's4_c_aL_rc'],
                            formulaAnnotations: [
                                {elementId: 's4_c_aL_rc', text: "∂L/∂a", position: 'bottom', dy: 5},
                                {elementId: 's4_c_za_rc', text: "∂a/∂z", position: 'bottom', dy: 5},
                                {elementId: 's4_c_Wz_rc', text: "∂z/∂W", position: 'bottom', dy: 5}
                            ]
                        }
                    ]
                }
            },
            { 
                title: "5. Forward Propagation",
                 content: `
                    <h3>5. Paso hacia Adelante (Forward Propagation)</h3>
                    <p>Antes de poder retropropagar el error, la información debe fluir hacia adelante a través de la red. Este proceso se llama <strong class='text-blue-600'>paso hacia adelante</strong> o <strong class='text-blue-600'>forward propagation</strong>.</p>
                    <ol class="list-decimal list-inside ml-4">
                        <li>Se presentan los datos de entrada ($x$) a la primera capa de la red.</li>
                        <li>Para cada capa, desde la primera hasta la última:
                            <ul class="list-disc list-inside ml-4">
                                <li>Se calcula la suma ponderada ($z^l$) para cada neurona en la capa $l$: $z^l = W^l a^{l-1} + b^l$.</li>
                                <li>Se aplica la función de activación ($\sigma$) a $z^l$ para obtener la activación de la capa $a^l$: $a^l = \sigma(z^l)$.</li>
                            </ul>
                        </li>
                        <li>La activación de la última capa, $a^L$, es la predicción de la red ($y_{pred}$).</li>
                    </ol>
                    <p>Durante el forward pass, es crucial almacenar los valores intermedios ($z^l, a^l$).</p>
                    <p class="text-sm text-gray-600">Diagrama interactivo (use los botones para ver los pasos):</p>
                `,
                diagramDefinition: { 
                    title: "Forward Propagation (2 capas ocultas)",
                    viewBox: "0 0 450 320",
                    nodes: [ 
                        { id: 'i1_fp', label: 'x₁', type: 'input', x: 40, y: 70 }, { id: 'i2_fp', label: 'x₂', type: 'input', x: 40, y: 150 },
                        { id: 'b1_fp', label: 'b⁽¹⁾', type: 'bias', x: 40, y: 230 }, 
                        { id: 'h1_1_fp', label: 'a₁⁽¹⁾', type: 'neuron', x: 160, y: 50 }, { id: 'h1_2_fp', label: 'a₂⁽¹⁾', type: 'neuron', x: 160, y: 120 }, { id: 'h1_3_fp', label: 'a₃⁽¹⁾', type: 'neuron', x: 160, y: 190 },
                        { id: 'b2_fp', label: 'b⁽²⁾', type: 'bias', x: 160, y: 270 }, 
                        { id: 'h2_1_fp', label: 'a₁⁽²⁾', type: 'neuron', x: 280, y: 85 }, { id: 'h2_2_fp', label: 'a₂⁽²⁾', type: 'neuron', x: 280, y: 175 },
                        { id: 'b3_fp', label: 'b⁽³⁾', type: 'bias', x: 280, y: 255 },
                        { id: 'o1_fp', label: 'ŷ', type: 'output', x: 380, y: 130 }
                    ],
                    connections: [ 
                        { id: 'c_i1_h11_fp', from: 'i1_fp', to: 'h1_1_fp', arrow: true }, { id: 'c_i1_h12_fp', from: 'i1_fp', to: 'h1_2_fp', arrow: true }, { id: 'c_i1_h13_fp', from: 'i1_fp', to: 'h1_3_fp', arrow: true },
                        { id: 'c_i2_h11_fp', from: 'i2_fp', to: 'h1_1_fp', arrow: true }, { id: 'c_i2_h12_fp', from: 'i2_fp', to: 'h1_2_fp', arrow: true }, { id: 'c_i2_h13_fp', from: 'i2_fp', to: 'h1_3_fp', arrow: true },
                        { id: 'c_b1_h11_fp', from: 'b1_fp', to: 'h1_1_fp', arrow: true }, { id: 'c_b1_h12_fp', from: 'b1_fp', to: 'h1_2_fp', arrow: true }, { id: 'c_b1_h13_fp', from: 'b1_fp', to: 'h1_3_fp', arrow: true },
                        { id: 'c_h11_h21_fp', from: 'h1_1_fp', to: 'h2_1_fp', arrow: true }, { id: 'c_h11_h22_fp', from: 'h1_1_fp', to: 'h2_2_fp', arrow: true },
                        { id: 'c_h12_h21_fp', from: 'h1_2_fp', to: 'h2_1_fp', arrow: true }, { id: 'c_h12_h22_fp', from: 'h1_2_fp', to: 'h2_2_fp', arrow: true },
                        { id: 'c_h13_h21_fp', from: 'h1_3_fp', to: 'h2_1_fp', arrow: true }, { id: 'c_h13_h22_fp', from: 'h1_3_fp', to: 'h2_2_fp', arrow: true },
                        { id: 'c_b2_h21_fp', from: 'b2_fp', to: 'h2_1_fp', arrow: true }, { id: 'c_b2_h22_fp', from: 'b2_fp', to: 'h2_2_fp', arrow: true },
                        { id: 'c_h21_o1_fp', from: 'h2_1_fp', to: 'o1_fp', arrow: true }, { id: 'c_h22_o1_fp', from: 'h2_2_fp', to: 'o1_fp', arrow: true },
                        { id: 'c_b3_o1_fp', from: 'b3_fp', to: 'o1_fp', arrow: true },
                    ],
                    states: [ 
                        { title: "Forward: Capa Entrada", description: "Entradas x₁, x₂ y sesgos b⁽¹⁾", highlightedNodes: ['i1_fp', 'i2_fp', 'b1_fp'], 
                          formulaAnnotations: [
                              {elementId: 'h1_1_fp', text: "z₁⁽¹⁾=w₁₁x₁+w₁₂x₂+b₁⁽¹⁾", position:'top', dy:-15, dx:-20},
                          ]
                        },
                        { title: "Forward: -> Capa Oculta 1", description: "Cálculo de activaciones a⁽¹⁾ = σ(W⁽¹⁾x + b⁽¹⁾)", highlightedNodes: ['i1_fp','i2_fp','b1_fp', 'h1_1_fp', 'h1_2_fp', 'h1_3_fp'], highlightedConnections: ['c_i1_h11_fp', 'c_i1_h12_fp', 'c_i1_h13_fp', 'c_i2_h11_fp', 'c_i2_h12_fp', 'c_i2_h13_fp', 'c_b1_h11_fp', 'c_b1_h12_fp', 'c_b1_h13_fp'],
                          formulaAnnotations: [
                              {elementId: 'h1_1_fp', text: "a₁⁽¹⁾=σ(z₁⁽¹⁾)", position:'right', dx:5},
                              {elementId: 'h1_2_fp', text: "a₂⁽¹⁾=σ(z₂⁽¹⁾)", position:'right', dx:5},
                              {elementId: 'h1_3_fp', text: "a₃⁽¹⁾=σ(z₃⁽¹⁾)", position:'right', dx:5},
                          ]
                        },
                        { title: "Forward: -> Capa Oculta 2", description: "Cálculo de activaciones a⁽²⁾ = σ(W⁽²⁾a⁽¹⁾ + b⁽²⁾)", highlightedNodes: ['h1_1_fp', 'h1_2_fp', 'h1_3_fp', 'b2_fp', 'h2_1_fp', 'h2_2_fp'], highlightedConnections: ['c_h11_h21_fp', 'c_h11_h22_fp', 'c_h12_h21_fp', 'c_h12_h22_fp', 'c_h13_h21_fp', 'c_h13_h22_fp', 'c_b2_h21_fp', 'c_b2_h22_fp'],
                          formulaAnnotations: [
                              {elementId: 'h2_1_fp', text: "a₁⁽²⁾=σ(z₁⁽²⁾)", position:'right', dx:5},
                              {elementId: 'h2_2_fp', text: "a₂⁽²⁾=σ(z₂⁽²⁾)", position:'right', dx:5},
                          ]
                        },
                        { title: "Forward: -> Capa Salida", description: "Cálculo de predicción ŷ = σ(W⁽³⁾a⁽²⁾ + b⁽³⁾)", highlightedNodes: ['h2_1_fp', 'h2_2_fp', 'b3_fp', 'o1_fp'], highlightedConnections: ['c_h21_o1_fp', 'c_h22_o1_fp', 'c_b3_o1_fp'],
                          formulaAnnotations: [
                              {elementId: 'o1_fp', text: "ŷ = σ(z⁽³⁾)", position:'right', dx:5},
                          ]
                        },
                        { title: "Forward: Red Completa", description: "Flujo completo de información hacia adelante", 
                          highlightedNodes: ['i1_fp', 'i2_fp', 'b1_fp', 'h1_1_fp', 'h1_2_fp', 'h1_3_fp', 'b2_fp', 'h2_1_fp', 'h2_2_fp', 'b3_fp', 'o1_fp'], 
                          highlightedConnections: ['c_i1_h11_fp', 'c_i1_h12_fp', 'c_i1_h13_fp', 'c_i2_h11_fp', 'c_i2_h12_fp', 'c_i2_h13_fp', 'c_b1_h11_fp', 'c_b1_h12_fp', 'c_b1_h13_fp', 'c_h11_h21_fp', 'c_h11_h22_fp', 'c_h12_h21_fp', 'c_h12_h22_fp', 'c_h13_h21_fp', 'c_h13_h22_fp', 'c_b2_h21_fp', 'c_b2_h22_fp', 'c_h21_o1_fp', 'c_h22_o1_fp', 'c_b3_o1_fp']
                        }
                    ]
                }
            },
            { // Subtopic 6: Backward Pass: Capa Salida
                title: "6. Backward Pass: Capa Salida",
                 content: `
                    <h3>6. Paso hacia Atrás (Backward Propagation): Error en la Capa de Salida</h3>
                    <p>Una vez que tenemos la predicción ($a^L$) y la comparamos con el valor real ($y_{true}$) usando la función de pérdida $L$, comienza el <strong class='text-blue-600'>paso hacia atrás</strong>.</p>
                    <p>El primer paso es calcular cómo la pérdida cambia con respecto a la activación de la capa de salida y con respecto a la suma ponderada $z^L$ de la capa de salida. Definimos el "error" de la capa de salida $\delta^L$ como:</p>
                    <div class="math-formula">$\\delta^L = \\frac{\\partial L}{\\partial a^L} \\odot \\sigma'(z^L)$</div>
                    <p>Donde $\\odot$ representa la multiplicación elemento a elemento (producto Hadamard), y $\\sigma'(z^L)$ es la derivada de la función de activación evaluada en $z^L$.</p>
                    <p>Con $\delta^L$, podemos calcular los gradientes de la pérdida con respecto a los pesos ($W^L$) y sesgos ($b^L$) de la capa de salida:</p>
                    <div class="math-formula">$\\frac{\\partial L}{\\partial W^L} = \\delta^L (a^{L-1})^T$</div>
                    <div class="math-formula">$\\frac{\\partial L}{\\partial b^L} = \\delta^L$</div>
                    <p class="text-sm text-gray-600">Diagrama interactivo (use los botones para ver los pasos):</p>
                `,
                diagramDefinition: (() => {
                    const idPrefix = "s6_bps";
                    const origin = { x: 30, y: 60}; 
                    const fwdNodes = [ 
                        { id: `${idPrefix}_aL-1`, label: 'a⁽ᴸ⁻¹⁾', type: 'input', x: origin.x, y: origin.y + 40 },
                        { id: `${idPrefix}_bL`, label: 'b⁽ᴸ⁾', type: 'bias', x: origin.x, y: origin.y + 120 },
                        { id: `${idPrefix}_zL`, label: 'z⁽ᴸ⁾', type: 'sum', x: origin.x + 100, y: origin.y + 80 },
                        { id: `${idPrefix}_aL`, label: 'a⁽ᴸ⁾=ŷ', type: 'neuron', x: origin.x + 200, y: origin.y + 80 },
                        { id: `${idPrefix}_L`, label: 'L', type: 'output', x: origin.x + 300, y: origin.y + 80 },
                        { id: `${idPrefix}_deltaL`, label: 'δ⁽ᴸ⁾', type: 'error', x: origin.x + 200, y: origin.y + 160 },
                    ];
                    const fwdConnections = [
                        { id: `${idPrefix}_c_a_zL`, from: `${idPrefix}_aL-1`, to: `${idPrefix}_zL`, label: 'W⁽ᴸ⁾', arrow: true },
                        { id: `${idPrefix}_c_b_zL`, from: `${idPrefix}_bL`, to: `${idPrefix}_zL`, arrow: true },
                        { id: `${idPrefix}_c_zL_aL`, from: `${idPrefix}_zL`, to: `${idPrefix}_aL`, label: 'σ', arrow: true },
                        { id: `${idPrefix}_c_aL_L`, from: `${idPrefix}_aL`, to: `${idPrefix}_L`, arrow: true },
                        { id: `${idPrefix}_c_L_deltaL`, from: `${idPrefix}_L`, to: `${idPrefix}_deltaL`, label: "∂L/∂a⁽ᴸ⁾", dashed: true, arrow: true, labelOffset: 10 },
                        { id: `${idPrefix}_c_zL_deltaL`, from: `${idPrefix}_zL`, to: `${idPrefix}_deltaL`, label: "σ'(z⁽ᴸ⁾)", dashed: true, arrow: true, labelOffset: 10 }
                    ];
                    
                    const gradWUnit_s6 = generateGradientCalculationUnit(`${idPrefix}_gcW`, {x: origin.x, y: origin.y + 220}, `δ⁽ᴸ⁾`, `a⁽ᴸ⁻¹⁾`, 'W⁽ᴸ⁾');
                    gradWUnit_s6.connections.find(c => c.from === `${idPrefix}_gcW_error_signal`).from = `${idPrefix}_deltaL`;
                    gradWUnit_s6.connections.find(c => c.from === `${idPrefix}_gcW_prev_activation`).from = `${idPrefix}_aL-1`;
                    
                    const gradBUnit_s6 = generateGradientCalculationUnit(`${idPrefix}_gcB`, {x: origin.x + 150, y: origin.y + 220}, `δ⁽ᴸ⁾`, null, 'b⁽ᴸ⁾');
                    gradBUnit_s6.connections.find(c => c.from === `${idPrefix}_gcB_error_signal`).from = `${idPrefix}_deltaL`;

                    return {
                        title: "Backward Pass (Capa Salida L)",
                        viewBox: "0 0 450 400", 
                        nodes: [...fwdNodes, ...gradWUnit_s6.nodes, ...gradBUnit_s6.nodes],
                        connections: [
                            ...fwdConnections, ...gradWUnit_s6.connections, ...gradBUnit_s6.connections,
                            { id: `${idPrefix}_c_delta_prop_zL`, from: `${idPrefix}_deltaL`, to: `${idPrefix}_zL`, label: ' ', type:'errorFlow', dashed: true, arrow: true }
                        ],
                        states: [
                             { title: "BP Salida: Forward y Pérdida", description: "Forward pass para capa L y cálculo de Pérdida L.", 
                               highlightedNodes: [`${idPrefix}_aL-1`, `${idPrefix}_bL`, `${idPrefix}_zL`, `${idPrefix}_aL`, `${idPrefix}_L`], 
                               highlightedConnections: [`${idPrefix}_c_a_zL`, `${idPrefix}_c_b_zL`, `${idPrefix}_c_zL_aL`, `${idPrefix}_c_aL_L`] 
                             },
                             { title: "BP Salida: Cálculo de δ⁽ᴸ⁾", description: "Calcular δ⁽ᴸ⁾ = (∂L/∂a⁽ᴸ⁾) ⊙ σ'(z⁽ᴸ⁾).", 
                               highlightedNodes: [`${idPrefix}_L`, `${idPrefix}_aL`, `${idPrefix}_zL`, `${idPrefix}_deltaL`], 
                               highlightedConnections: [`${idPrefix}_c_aL_L`, `${idPrefix}_c_L_deltaL`, `${idPrefix}_c_zL_deltaL`],
                               formulaAnnotations: [{elementId: `${idPrefix}_deltaL`, text:"δ⁽ᴸ⁾=(∂L/∂a⁽ᴸ⁾)σ'(z⁽ᴸ⁾)", position:'bottom', dy:10}]
                             },
                             { title: "BP Salida: ∂L/∂W⁽ᴸ⁾", description: "Calcular ∂L/∂W⁽ᴸ⁾ = δ⁽ᴸ⁾ (a⁽ᴸ⁻¹⁾)ᵀ.", 
                               highlightedNodes: [`${idPrefix}_deltaL`, `${idPrefix}_aL-1`, `${idPrefix}_gcW_grad_param`], 
                               highlightedConnections: gradWUnit_s6.connections.map(c => c.id).concat([`${idPrefix}_c_a_zL`]),
                               formulaAnnotations: [{elementId: `${idPrefix}_gcW_grad_param`, text:"δ⁽ᴸ⁾(a⁽ᴸ⁻¹⁾)ᵀ", position:'bottom', dy:10}]
                             },
                             { title: "BP Salida: ∂L/∂b⁽ᴸ⁾", description: "Calcular ∂L/∂b⁽ᴸ⁾ = δ⁽ᴸ⁾.", 
                               highlightedNodes: [`${idPrefix}_deltaL`, `${idPrefix}_gcB_grad_param`], 
                               highlightedConnections: gradBUnit_s6.connections.map(c => c.id),
                               formulaAnnotations: [{elementId: `${idPrefix}_gcB_grad_param`, text:"δ⁽ᴸ⁾", position:'bottom', dy:10}]
                             },
                             { title: "BP Salida: Propagación Error", description: "δ⁽ᴸ⁾ se usa para calcular errores en capas previas (vía W⁽ᴸ⁾).", 
                               highlightedNodes: [`${idPrefix}_deltaL`, `${idPrefix}_zL`, `${idPrefix}_aL-1`], 
                               highlightedConnections: [`${idPrefix}_c_delta_prop_zL`, `${idPrefix}_c_a_zL`],
                               formulaAnnotations: [{elementId: `${idPrefix}_c_delta_prop_zL`, text:"Propagar δ⁽ᴸ⁾", position:'top', dy:-5}]
                             }
                        ]
                    };
                })()
            },
             { // Subtopic 7: Backward Pass: Capas Ocultas
                title: "7. Backward Pass: Capas Ocultas",
                content: `
                    <h3>7. Paso hacia Atrás: Propagación del Error a Capas Ocultas</h3>
                    <p>Una vez que tenemos el error $\delta^L$ de la capa de salida, podemos propagarlo hacia atrás para calcular el error $\delta^l$ para cada capa oculta $l$ (desde $L-1$ hasta la primera capa oculta).</p>
                    <p>El error $\delta^l$ para una capa oculta $l$ se calcula en función del error de la siguiente capa $\delta^{l+1}$ y los pesos $W^{l+1}$ que conectan la capa $l$ con la capa $l+1$:</p>
                    <div class="math-formula">$\\delta^l = ((W^{l+1})^T \\delta^{l+1}) \\odot \\sigma'(z^l)$</div>
                    <p>Una vez que tenemos $\delta^l$ para una capa oculta, podemos calcular los gradientes de la pérdida con respecto a los pesos $W^l$ y sesgos $b^l$ de esa capa:</p>
                    <div class="math-formula">$\\frac{\\partial L}{\\partial W^l} = \\delta^l (a^{l-1})^T$</div>
                    <div class="math-formula">$\\frac{\\partial L}{\\partial b^l} = \\delta^l$</div>
                    <p class="text-sm text-gray-600">Diagrama interactivo (use los botones para ver los pasos):</p>
                `,
                diagramDefinition: (() => {
                    const idPrefix = "s7_bph";
                    const origin = { x: 30, y: 40 }; 
                    const fwdNodes = [
                        { id: `${idPrefix}_al-1`, label: 'a⁽ˡ⁻¹⁾', type: 'input', x: origin.x, y: origin.y + 110},
                        { id: `${idPrefix}_zl`, label: 'z⁽ˡ⁾', type: 'sum', x: origin.x + 100, y: origin.y + 110},
                        { id: `${idPrefix}_al`, label: 'a⁽ˡ⁾', type: 'neuron', x: origin.x + 200, y: origin.y + 110},
                    ];
                    const fwdConnections = [
                        { id: `${idPrefix}_c_al-1_zl`, from: `${idPrefix}_al-1`, to: `${idPrefix}_zl`, label: 'W⁽ˡ⁾', arrow: true },
                        { id: `${idPrefix}_c_zl_al`, from: `${idPrefix}_zl`, to: `${idPrefix}_al`, label: 'σ', arrow: true },
                    ];

                    const bepUnit_s7 = generateBackwardErrorPropagationUnit(
                        `${idPrefix}_bep`, {x: origin.x + 180, y: origin.y}, 
                        'δ⁽ˡ⁺¹⁾', "σ'(z⁽ˡ⁾)", "(W⁽ˡ⁺¹⁾)ᵀ"
                    );
                    
                    bepUnit_s7.connections.find(c => c.from === `${idPrefix}_bep_local_act_deriv`).from = `${idPrefix}_zl`; 
                    const delta_l_node_id = `${idPrefix}_bep_current_delta`; 
                    
                    const gradWUnit_s7 = generateGradientCalculationUnit(`${idPrefix}_gcW`, {x: origin.x + 50, y: origin.y + 220}, `δ⁽ˡ⁾`, `a⁽ˡ⁻¹⁾`, 'W⁽ˡ⁾');
                    gradWUnit_s7.connections.find(c=>c.from ===`${idPrefix}_gcW_error_signal`).from = delta_l_node_id;
                    gradWUnit_s7.connections.find(c=>c.from ===`${idPrefix}_gcW_prev_activation`).from = `${idPrefix}_al-1`;
                    
                    const gradBUnit_s7 = generateGradientCalculationUnit(`${idPrefix}_gcB`, {x: origin.x + 200, y: origin.y + 220}, `δ⁽ˡ⁾`, null, 'b⁽ˡ⁾');
                    gradBUnit_s7.connections.find(c=>c.from ===`${idPrefix}_gcB_error_signal`).from = delta_l_node_id;

                    return {
                        title: "Backward Pass (Capa Oculta l)",
                        viewBox: "0 0 550 400",
                        nodes: [...fwdNodes, ...bepUnit_s7.nodes, ...gradWUnit_s7.nodes, ...gradBUnit_s7.nodes],
                        connections: [
                            ...fwdConnections, ...bepUnit_s7.connections, ...gradWUnit_s7.connections, ...gradBUnit_s7.connections,
                            { id: `${idPrefix}_c_al_next_delta_conceptual`, from: `${idPrefix}_al`, to: `${idPrefix}_bep_next_delta`, label: '', arrow:true, dashed:true, style:{'stroke-dasharray':'2 2', stroke:'#ccc'}},
                            { id: `${idPrefix}_c_delta_prop_zl`, from: delta_l_node_id, to: `${idPrefix}_zl`, label: ' ', type:'errorFlow', dashed: true, arrow: true }
                        ],
                        states: [
                            { title: "BP Oculta: Forward y Conexión a Capa l+1", description: "Forward pass para la capa l y su conexión a δ⁽ˡ⁺¹⁾.", 
                              highlightedNodes: [`${idPrefix}_al-1`, `${idPrefix}_zl`, `${idPrefix}_al`, `${idPrefix}_bep_next_delta`], 
                              highlightedConnections: [`${idPrefix}_c_al-1_zl`, `${idPrefix}_c_zl_al`, `${idPrefix}_c_al_next_delta_conceptual`] 
                            },
                            { title: "BP Oculta: Paso 1 - Cálculo de δ⁽ˡ⁾", description: "Calcular δ⁽ˡ⁾ = ((W⁽ˡ⁺¹⁾)ᵀ δ⁽ˡ⁺¹⁾) ⊙ σ'(z⁽ˡ⁾).", 
                              highlightedNodes: [ `${idPrefix}_bep_next_delta`, `${idPrefix}_bep_connecting_weight`, `${idPrefix}_bep_multiply_weight_delta`, `${idPrefix}_bep_local_act_deriv`, delta_l_node_id, `${idPrefix}_zl`], 
                              highlightedConnections: bepUnit_s7.connections.map(c=>c.id).concat([`${idPrefix}_c_zl_al`]),
                              formulaAnnotations: [{elementId: delta_l_node_id, text:"δ⁽ˡ⁾ = ((W⁽ˡ⁺¹⁾)ᵀδ⁽ˡ⁺¹⁾)⊙σ'(z⁽ˡ⁾)", position:'bottom', dy:15}]
                            },
                            { title: "BP Oculta: Paso 2 - ∂L/∂W⁽ˡ⁾", description: "Calcular ∂L/∂W⁽ˡ⁾ = δ⁽ˡ⁾ (a⁽ˡ⁻¹⁾)ᵀ.", 
                              highlightedNodes: [delta_l_node_id, `${idPrefix}_al-1`, `${idPrefix}_gcW_grad_param`], 
                              highlightedConnections: gradWUnit_s7.connections.map(c => c.id).concat([`${idPrefix}_c_al-1_zl`]),
                              formulaAnnotations: [{elementId: `${idPrefix}_gcW_grad_param`, text:"δ⁽ˡ⁾(a⁽ˡ⁻¹⁾)ᵀ", position:'bottom', dy:10}]
                            },
                            { title: "BP Oculta: Paso 3 - ∂L/∂b⁽ˡ⁾", description: "Calcular ∂L/∂b⁽ˡ⁾ = δ⁽ˡ⁾.", 
                              highlightedNodes: [delta_l_node_id, `${idPrefix}_gcB_grad_param`], 
                              highlightedConnections: gradBUnit_s7.connections.map(c => c.id),
                               formulaAnnotations: [{elementId: `${idPrefix}_gcB_grad_param`, text:"δ⁽ˡ⁾", position:'bottom', dy:10}]
                            },
                            { title: "BP Oculta: Propagación Error", description: "δ⁽ˡ⁾ se usa para calcular errores en capas previas (vía W⁽ˡ⁾).", 
                              highlightedNodes: [delta_l_node_id, `${idPrefix}_zl`, `${idPrefix}_al-1`], 
                              highlightedConnections: [`${idPrefix}_c_delta_prop_zl`, `${idPrefix}_c_al-1_zl`],
                               formulaAnnotations: [{elementId: `${idPrefix}_c_delta_prop_zl`, text:"Propagar δ⁽ˡ⁾", position:'top', dy:-5}]
                            }
                        ]
                    };
                })()
            },
            { // Subtopic 8: Actualización de Pesos (Uses generateGradientUpdateUnit)
                title: "8. Actualización de Pesos",
                content: `
                    <h3>8. Actualización de Pesos y Sesgos</h3>
                    <p>Después de completar el paso hacia atrás (backward pass), hemos calculado los gradientes de la función de pérdida con respecto a todos los pesos ($W^l$) y sesgos ($b^l$) en la red.</p>
                    <p>El siguiente paso es actualizar estos parámetros utilizando la regla del descenso del gradiente:</p>
                    <div class="math-formula">$W^l_{nuevo} = W^l_{viejo} - \\eta \\frac{\\partial L}{\\partial W^l}$</div>
                    <div class="math-formula">$b^l_{nuevo} = b^l_{viejo} - \\eta \\frac{\\partial L}{\\partial b^l}$</div>
                    <p>Donde $\eta$ es la tasa de aprendizaje. Esta actualización se realiza para todos los pesos y sesgos en todas las capas. Todo el proceso (paso hacia adelante, cálculo de la pérdida, paso hacia atrás y actualización de pesos) constituye una <strong class='text-blue-600'>iteración</strong> de entrenamiento.</p>
                    <p class="text-sm text-gray-600">Diagrama interactivo (use los botones para ver los pasos):</p>
                `,
                 diagramDefinition: { 
                    title: "Actualización de Peso W",
                    viewBox: "0 0 500 280", 
                    nodes: s8_gradUpdateUnit.nodes,
                    connections: s8_gradUpdateUnit.connections,
                    states: [
                        { title: "Actualización: Paso 1", description: "Se tienen W_viejo y el gradiente ∂L/∂W.", 
                          highlightedNodes: ['s8_upd_param_old', 's8_upd_grad'],
                          highlightedConnections: [],
                          formulaAnnotations: [
                              {elementId: 's8_upd_param_old', text: "W_t", position: 'top'},
                              {elementId: 's8_upd_grad', text: "∇L(W_t)", position: 'bottom'}
                          ]
                        },
                        { title: "Actualización: Paso 2", description: "Se multiplica el gradiente por la tasa de aprendizaje η.", 
                          highlightedNodes: ['s8_upd_grad', 's8_upd_eta', 's8_upd_multiply'], 
                          highlightedConnections: ['s8_upd_conn_grad_mult', 's8_upd_conn_eta_mult', 's8_upd_conn_mult_sub'],
                          formulaAnnotations: [
                              {elementId: 's8_upd_eta', text: "η", position: 'bottom'},
                              {elementId: 's8_upd_multiply', text: "η∇L(W_t)", position: 'right', dx:10}
                          ]
                        },
                        { title: "Actualización: Paso 3", description: "Se resta η ∂L/∂W de W_viejo para obtener W_nuevo.", 
                          highlightedNodes: ['s8_upd_param_old', 's8_upd_multiply', 's8_upd_subtract', 's8_upd_param_new'], 
                          highlightedConnections: ['s8_upd_conn_mult_sub', 's8_upd_conn_old_sub', 's8_upd_conn_sub_new'],
                          formulaAnnotations: [
                              {elementId: 's8_upd_param_new', text: "W_t+1 = W_t - η∇L(W_t)", position: 'top'}
                          ]
                        }
                    ]
                }
            },
            { // Subtopic 9: Ejemplo Simplificado (Complex composition)
                title: "9. Ejemplo Simplificado",
                 content: `
                    <h3>9. Ejemplo Práctico Simplificado (Paso a Paso)</h3>
                    <p>Consideremos una red muy simple: 1 entrada $x$, 1 neurona en una capa oculta con activación $\sigma_h$, y 1 neurona de salida con activación $\sigma_o$.</p>
                    <p>Entrada: $x$ | Capa Oculta: $z_h = w_1 x + b_1$, $a_h = \sigma_h(z_h)$ | Capa de Salida: $z_o = w_2 a_h + b_2$, $a_o = \hat{y} = \sigma_o(z_o)$</p>
                    <p>Función de Pérdida (ej. MSE): $L = \\frac{1}{2} (y_{true} - \hat{y})^2$</p>
                    <p><strong>Paso hacia Adelante:</strong> Calcular $z_h, a_h, z_o, \hat{y}$.</p>
                    <p><strong>Paso hacia Atrás (Gradientes):</strong></p>
                    <div class="math-formula">$\\delta_o = (a_o - y_{true}) \\sigma_o'(z_o)$</div>
                    <div class="math-formula">$\\frac{\\partial L}{\\partial w_2} = \\delta_o a_h \\quad ; \\quad \\frac{\\partial L}{\\partial b_2} = \\delta_o$</div>
                    <div class="math-formula">$\\delta_h = (\delta_o w_2) \\sigma_h'(z_h)$</div>
                    <div class="math-formula">$\\frac{\\partial L}{\\partial w_1} = \\delta_h x \\quad ; \\quad \\frac{\\partial L}{\\partial b_1} = \\delta_h$</div>
                    <p><strong>Actualización:</strong> $w \leftarrow w - \eta \frac{\\partial L}{\\partial w}$, $b \leftarrow b - \eta \frac{\\partial L}{\\partial b}$ para $w_1, b_1, w_2, b_2$.</p>
                    <p class="text-sm text-gray-600">Diagrama interactivo (use los botones para ver los pasos):</p>
                `,
                diagramDefinition: (() => {
                    const idPrefix = "s9_ex";
                    const origin = { x: 30, y: 40 };
                    const spacingX = 90; 
                    const spacingY = 50;

                    const nodesFwd = [
                        { id: `${idPrefix}_x`, label: 'x', type: 'input', x: origin.x, y: origin.y + spacingY*1.5 }, 
                        { id: `${idPrefix}_b1`, label: 'b₁', type: 'bias', x: origin.x, y: origin.y + spacingY*2.5 },
                        { id: `${idPrefix}_zh`, label: 'zₕ', type: 'sum', x: origin.x + spacingX, y: origin.y + spacingY*2 },
                        { id: `${idPrefix}_ah`, label: 'aₕ', type: 'neuron', x: origin.x + spacingX*2, y: origin.y + spacingY*2 },
                        { id: `${idPrefix}_b2`, label: 'b₂', type: 'bias', x: origin.x + spacingX*2, y: origin.y + spacingY*3 },
                        { id: `${idPrefix}_zo`, label: 'zₒ', type: 'sum', x: origin.x + spacingX*3, y: origin.y + spacingY*2 },
                        { id: `${idPrefix}_ao`, label: 'aₒ=ŷ', type: 'neuron', x: origin.x + spacingX*4, y: origin.y + spacingY*2 },
                        { id: `${idPrefix}_L`, label: 'L', type: 'output', x: origin.x + spacingX*5, y: origin.y + spacingY*2 },
                    ];
                    const connFwd = [
                        { id: `${idPrefix}_c_x_zh`, from: `${idPrefix}_x`, to: `${idPrefix}_zh`, label: 'w₁', arrow: true },
                        { id: `${idPrefix}_c_b1_zh`, from: `${idPrefix}_b1`, to: `${idPrefix}_zh`, arrow: true },
                        { id: `${idPrefix}_c_zh_ah`, from: `${idPrefix}_zh`, to: `${idPrefix}_ah`, label: 'σₕ', arrow: true },
                        { id: `${idPrefix}_c_ah_zo`, from: `${idPrefix}_ah`, to: `${idPrefix}_zo`, label: 'w₂', arrow: true },
                        { id: `${idPrefix}_c_b2_zo`, from: `${idPrefix}_b2`, to: `${idPrefix}_zo`, arrow: true },
                        { id: `${idPrefix}_c_zo_ao`, from: `${idPrefix}_zo`, to: `${idPrefix}_ao`, label: 'σₒ', arrow: true },
                        { id: `${idPrefix}_c_ao_L`, from: `${idPrefix}_ao`, to: `${idPrefix}_L`, arrow: true },
                    ];

                    const delta_o_node = { id: `${idPrefix}_delta_o`, label: 'δₒ', type: 'error', x: origin.x + spacingX*4, y: origin.y + spacingY*3.5 };
                    
                    const gradW2Unit_s9 = generateGradientCalculationUnit(`${idPrefix}_gcW2`, {x: origin.x + spacingX*2.8, y: origin.y + spacingY*4}, `δₒ`, `aₕ`, 'w₂');
                    gradW2Unit_s9.connections.find(c=>c.from ===`${idPrefix}_gcW2_error_signal`).from = delta_o_node.id;
                    gradW2Unit_s9.connections.find(c=>c.from ===`${idPrefix}_gcW2_prev_activation`).from = `${idPrefix}_ah`;
                    
                    const gradB2Unit_s9 = generateGradientCalculationUnit(`${idPrefix}_gcB2`, {x: origin.x + spacingX*4.2, y: origin.y + spacingY*4}, `δₒ`, null, 'b₂');
                    gradB2Unit_s9.connections.find(c=>c.from ===`${idPrefix}_gcB2_error_signal`).from = delta_o_node.id;

                    const delta_h_node = { id: `${idPrefix}_delta_h`, label: 'δₕ', type: 'error', x: origin.x + spacingX*2, y: origin.y + spacingY*3.5 };
                    const connDeltaH = [
                        {id: `${idPrefix}_c_delta_o_dh`, from: delta_o_node.id, to: delta_h_node.id, label: "w₂⊙σ'(zₕ)", dashed:true, arrow:true, labelOffset:10},
                        {id: `${idPrefix}_c_zh_dh_context`, from: `${idPrefix}_zh`, to: delta_h_node.id, label: " ", dashed:true, arrow:true, style:{'stroke-dasharray':'2 2', stroke:'#ccc'}},
                    ];

                    const gradW1Unit_s9 = generateGradientCalculationUnit(`${idPrefix}_gcW1`, {x: origin.x + spacingX*0.8, y: origin.y + spacingY*4}, `δₕ`, `x`, 'w₁');
                    gradW1Unit_s9.connections.find(c=>c.from ===`${idPrefix}_gcW1_error_signal`).from = delta_h_node.id;
                    gradW1Unit_s9.connections.find(c=>c.from ===`${idPrefix}_gcW1_prev_activation`).from = `${idPrefix}_x`;

                    const gradB1Unit_s9 = generateGradientCalculationUnit(`${idPrefix}_gcB1`, {x: origin.x + spacingX*2.2, y: origin.y + spacingY*4}, `δₕ`, null, 'b₁');
                    gradB1Unit_s9.connections.find(c=>c.from ===`${idPrefix}_gcB1_error_signal`).from = delta_h_node.id;

                    const nodes = [...nodesFwd, delta_o_node, ...gradW2Unit_s9.nodes, ...gradB2Unit_s9.nodes, delta_h_node, ...gradW1Unit_s9.nodes, ...gradB1Unit_s9.nodes];
                    const connections = [
                        ...connFwd, 
                        {id: `${idPrefix}_c_L_delta_o`, from: `${idPrefix}_L`, to: delta_o_node.id, label: " ", dashed:true, arrow:true, labelOffset:10},
                        {id: `${idPrefix}_c_zo_do_context`, from: `${idPrefix}_zo`, to: delta_o_node.id, label: " ", dashed:true, arrow:true, style:{'stroke-dasharray':'2 2', stroke:'#ccc'}},
                        ...gradW2Unit_s9.connections, ...gradB2Unit_s9.connections, 
                        ...connDeltaH,
                        ...gradW1Unit_s9.connections, ...gradB1Unit_s9.connections
                    ];
                    
                    return {
                        title: "Red Simple (1-1-1) Flujo Completo",
                        viewBox: "0 0 600 380", 
                        nodes: nodes,
                        connections: connections,
                        states: [
                            { title: "Ej. Simple: Forward - Capa Oculta (zₕ, aₕ)", description: "Cálculo de zₕ = w₁x + b₁ y aₕ = σₕ(zₕ).", 
                              highlightedNodes: [`${idPrefix}_x`, `${idPrefix}_b1`, `${idPrefix}_zh`, `${idPrefix}_ah`], 
                              highlightedConnections: [`${idPrefix}_c_x_zh`, `${idPrefix}_c_b1_zh`, `${idPrefix}_c_zh_ah`],
                              formulaAnnotations: [ {elementId: `${idPrefix}_zh`, text: "zₕ=w₁x+b₁", position:'top', dy:-10}, {elementId: `${idPrefix}_ah`, text: "aₕ=σ(zₕ)", position:'top', dy:-10}]
                            },
                            { title: "Ej. Simple: Forward - Capa Salida (zₒ, aₒ)", description: "Cálculo de zₒ = w₂aₕ + b₂ y aₒ = σₒ(zₒ).", 
                              highlightedNodes: [`${idPrefix}_ah`, `${idPrefix}_b2`, `${idPrefix}_zo`, `${idPrefix}_ao`], 
                              highlightedConnections: [`${idPrefix}_c_ah_zo`, `${idPrefix}_c_b2_zo`, `${idPrefix}_c_zo_ao`],
                              formulaAnnotations: [ {elementId: `${idPrefix}_zo`, text: "zₒ=w₂aₕ+b₂", position:'top', dy:-10}, {elementId: `${idPrefix}_ao`, text: "aₒ=σ(zₒ)", position:'top', dy:-10}]
                            },
                            { title: "Ej. Simple: Forward - Cálculo de Pérdida L", description: "Cálculo de L = ½(y - aₒ)². (y no se muestra).", 
                              highlightedNodes: [`${idPrefix}_ao`, `${idPrefix}_L`], highlightedConnections: [`${idPrefix}_c_ao_L`],
                              formulaAnnotations: [{elementId: `${idPrefix}_L`, text: "L=½(y-aₒ)²", position:'top', dy:-10}]
                            },
                            { title: "Ej. Simple: Backward - δₒ en Capa Salida", description: "Cálculo de δₒ = (aₒ - y)σₒ'(zₒ).", 
                              highlightedNodes: [`${idPrefix}_L`, `${idPrefix}_ao`, `${idPrefix}_zo`, delta_o_node.id], 
                              highlightedConnections: [`${idPrefix}_c_L_delta_o`, `${idPrefix}_c_zo_ao`, `${idPrefix}_c_zo_do_context`],
                              formulaAnnotations: [{elementId: delta_o_node.id, text:"δₒ=(aₒ-y)σₒ'(zₒ)", position:'bottom', dy:10}]
                            },
                            { title: "Ej. Simple: Backward - Gradientes ∂L/∂w₂, ∂L/∂b₂", description: "Cálculo de ∂L/∂w₂ = δₒaₕ y ∂L/∂b₂ = δₒ.", 
                              highlightedNodes: [delta_o_node.id, `${idPrefix}_ah`, `${idPrefix}_b2`, `${idPrefix}_gcW2_grad_param`, `${idPrefix}_gcB2_grad_param`], 
                              highlightedConnections: gradW2Unit_s9.connections.map(c=>c.id).concat(gradB2Unit_s9.connections.map(c=>c.id), [`${idPrefix}_c_ah_zo`]),
                              formulaAnnotations: [ {elementId: `${idPrefix}_gcW2_grad_param`, text:"∂L/∂w₂=δₒaₕ", position:'bottom', dy:10}, {elementId: `${idPrefix}_gcB2_grad_param`, text:"∂L/∂b₂=δₒ", position:'bottom', dy:10}]
                            },
                            { title: "Ej. Simple: Backward - δₕ en Capa Oculta", description: "Cálculo de δₕ = (δₒw₂)σₕ'(zₕ).", 
                              highlightedNodes: [delta_o_node.id, `${idPrefix}_ah`, `${idPrefix}_zo`, `${idPrefix}_zh`, delta_h_node.id], 
                              highlightedConnections: connDeltaH.map(c=>c.id).concat([`${idPrefix}_c_ah_zo`, `${idPrefix}_c_zh_ah`]), 
                              formulaAnnotations: [{elementId: delta_h_node.id, text:"δₕ=(δₒw₂)σₕ'(zₕ)", position:'bottom', dy:10}]
                            },
                            { title: "Ej. Simple: Backward - Gradientes ∂L/∂w₁, ∂L/∂b₁", description: "Cálculo de ∂L/∂w₁ = δₕx y ∂L/∂b₁ = δₕ.", 
                              highlightedNodes: [delta_h_node.id, `${idPrefix}_x`, `${idPrefix}_b1`, `${idPrefix}_gcW1_grad_param`, `${idPrefix}_gcB1_grad_param`], 
                              highlightedConnections: gradW1Unit_s9.connections.map(c => c.id).concat(gradB1Unit_s9.connections.map(c=>c.id), [`${idPrefix}_c_x_zh`]),
                              formulaAnnotations: [ {elementId: `${idPrefix}_gcW1_grad_param`, text:"∂L/∂w₁=δₕx", position:'bottom', dy:10}, {elementId: `${idPrefix}_gcB1_grad_param`, text:"∂L/∂b₁=δₕ", position:'bottom', dy:10}]
                            },
                            { title: "Ej. Simple: Actualización (Conceptual)", description: "Todos los pesos (w₁, b₁, w₂, b₂) se actualizan usando sus gradientes y η.", 
                              highlightedNodes: [`${idPrefix}_gcW1_grad_param`, `${idPrefix}_gcB1_grad_param`, `${idPrefix}_gcW2_grad_param`, `${idPrefix}_gcB2_grad_param`] 
                            }
                        ]
                    };
                })()
            },
            {
                title: "10. Consideraciones",
                content: `
                    <h3>10. Consideraciones y Mejoras</h3>
                    <p>Si bien la retropropagación es poderosa, existen desafíos y mejoras:</p>
                    <ul class='list-disc list-inside ml-4'>
                        <li><strong class='text-gray-700'>Desvanecimiento/Explosión de Gradientes:</strong> En redes profundas, los gradientes pueden volverse extremadamente pequeños (desvanecimiento) o grandes (explosión) a medida que se propagan hacia atrás, dificultando el aprendizaje. Soluciones incluyen el uso de funciones de activación como ReLU, inicialización cuidadosa de pesos (ej. Xavier/He), y arquitecturas como ResNet.</li>
                        <li><strong class='text-gray-700'>Mínimos Locales:</strong> El descenso del gradiente puede quedar atrapado en mínimos locales de la función de pérdida, que no son el mínimo global. En la práctica, para redes grandes, esto suele ser menos problemático de lo que se pensaba, ya que muchos mínimos locales pueden ser suficientemente buenos.</li>
                        <li><strong class='text-gray-700'>Tasa de Aprendizaje:</strong> Elegir una buena tasa de aprendizaje es crucial. Se han desarrollado técnicas como los calendarios de tasa de aprendizaje (learning rate schedules) y tasas de aprendizaje adaptativas (ej. Adam, RMSProp).</li>
                        <li><strong class='text-gray-700'>Optimizadores Avanzados:</strong> Más allá del descenso de gradiente estándar (SGD), existen optimizadores más sofisticados como SGD con Momentum, AdaGrad, RMSProp, y Adam, que a menudo convergen más rápido y de manera más robusta.</li>
                        <li><strong class='text-gray-700'>Regularización:</strong> Técnicas como L1/L2 regularization o Dropout se usan para prevenir el sobreajuste (overfitting), donde la red aprende demasiado bien los datos de entrenamiento pero generaliza mal a datos nuevos.</li>
                        <li><strong class='text-gray-700'>Normalización por Lotes (Batch Normalization):</strong> Ayuda a estabilizar y acelerar el entrenamiento normalizando las entradas de cada capa.</li>
                    </ul>
                    <p>La investigación en la optimización de redes neuronales es un campo activo, con continuas mejoras y nuevas técnicas emergentes.</p>
                ` 
            }
        ];

        const tabsContainer = document.getElementById('tabs-container');
        const tabContentContainer = document.getElementById('tab-content-container');

        if (tabsContainer && tabContentContainer) {
            subtopicsData.forEach((topic, index) => {
                const tabButton = document.createElement('button');
                tabButton.classList.add('tab-button');
                if (index === 0) tabButton.classList.add('active');
                tabButton.textContent = topic.title;
                tabButton.setAttribute('data-tab', `tab-${index}`);
                tabsContainer.appendChild(tabButton);

                const tabContentDiv = document.createElement('div');
                tabContentDiv.classList.add('tab-content');
                if (index === 0) tabContentDiv.classList.add('active');
                tabContentDiv.id = `tab-${index}`;
                
                const contentParagraph = document.createElement('div');
                contentParagraph.innerHTML = topic.content; 
                tabContentDiv.appendChild(contentParagraph);

                if (topic.diagramDefinition) {
                    const diagramContainerId = `diagram-svg-container-tab-${index}`;
                    const diagramContainer = document.createElement('div');
                    diagramContainer.id = diagramContainerId;
                    diagramContainer.classList.add('diagram-svg-container');
                    diagramContainer.innerHTML = `<p class="p-4 text-center text-gray-500">Cargando diagrama...</p>`;
                    tabContentDiv.appendChild(diagramContainer);

                    const stateDescriptionDiv = document.createElement('div');
                    stateDescriptionDiv.classList.add('diagram-state-description');
                    tabContentDiv.appendChild(stateDescriptionDiv);


                    if (topic.diagramDefinition.states && topic.diagramDefinition.states.length > 1) {
                        const controlsDiv = document.createElement('div');
                        controlsDiv.classList.add('diagram-controls');
                        
                        const prevBtn = document.createElement('button');
                        prevBtn.textContent = 'Paso Anterior';
                        prevBtn.classList.add('diagram-prev-btn');
                        prevBtn.onclick = () => {
                            if (diagramInstances[diagramContainerId]) {
                                diagramInstances[diagramContainerId].prevState();
                            }
                        };
                        
                        const nextBtn = document.createElement('button');
                        nextBtn.textContent = 'Siguiente Paso';
                        nextBtn.classList.add('diagram-next-btn');
                        nextBtn.onclick = () => {
                             if (diagramInstances[diagramContainerId]) {
                                diagramInstances[diagramContainerId].nextState();
                            }
                        };
                        controlsDiv.appendChild(prevBtn);
                        controlsDiv.appendChild(nextBtn);
                        tabContentDiv.appendChild(controlsDiv);
                    }
                }
                tabContentContainer.appendChild(tabContentDiv);

                tabButton.addEventListener('click', () => {
                    tabsContainer.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
                    tabContentContainer.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
                    tabButton.classList.add('active');
                    tabContentDiv.classList.add('active');
                    
                    if (window.MathJax && typeof window.MathJax.typesetPromise === 'function') {
                        MathJax.typesetPromise([tabContentDiv]).catch((err) => console.error('Error MathJax en click de pestaña:', err));
                    }

                    if (topic.diagramDefinition) {
                        const diagramContainerId = `diagram-svg-container-tab-${index}`;
                        if (!diagramInstances[diagramContainerId] || !diagramInstances[diagramContainerId].svg) {
                             setTimeout(() => {
                                diagramInstances[diagramContainerId] = new InteractiveDiagram(diagramContainerId, topic.diagramDefinition);
                            },0);
                        } else {
                             diagramInstances[diagramContainerId].showFormulas = GlobalShowFormulaAnnotations; 
                             diagramInstances[diagramContainerId].updateViewBox(); 
                             diagramInstances[diagramContainerId].render(); 
                             diagramInstances[diagramContainerId].updateStateControls();
                        }
                    }
                });
            });
            // Ensure the first tab's diagram is loaded if it exists
            if (subtopicsData[0] && subtopicsData[0].diagramDefinition) {
                const firstDiagramContainerId = `diagram-svg-container-tab-0`;
                 // Use a timeout to ensure the DOM is ready for SVG rendering.
                 setTimeout(() => { 
                    if (!diagramInstances[firstDiagramContainerId]) { // Check if not already initialized
                         diagramInstances[firstDiagramContainerId] = new InteractiveDiagram(firstDiagramContainerId, subtopicsData[0].diagramDefinition);
                    }
                }, 0);
            }
        }

        // --- Clase Base para Ejemplos Interactivos de Algoritmos ---
        class InteractiveExample {
            constructor(idPrefix, svgId) {
                this.idPrefix = idPrefix;
                this.svg = document.getElementById(svgId);
                if (!this.svg) {
                    // console.error(`Elemento SVG con ID ${svgId} no encontrado para ${idPrefix}.`);
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
        class LinearRegressionExample extends InteractiveExample { 
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
        class SimpleNeuronExample extends InteractiveExample { 
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
            _sigmoidDerivative(a) { // Takes activation 'a' as input
                 return a * (1 - a);
            }

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
                const dOutputY_dZ = this._sigmoidDerivative(this.outputY); // Pass activation 'a' (this.outputY)
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
        class GradientDescent2DExample extends InteractiveExample { 
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
        class MultiPerceptronExample extends InteractiveExample { 
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
                        showMessage("Tasa de aprendizaje Inválida. Use valor entre 0.0001 y 0.5.", 3000);
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
            const fpsInputCtrl = document.getElementById('fpsControl');
            if (fpsInputCtrl) {
                fpsInputCtrl.value = GlobalAnimSettings.desiredFPS;
                fpsInputCtrl.addEventListener('change', (event) => {
                    GlobalAnimSettings.updateFPS(event.target.value);
                });
            }

            const formulaToggle = document.getElementById('showFormulaAnnotationsToggle');
            if (formulaToggle) {
                formulaToggle.checked = GlobalShowFormulaAnnotations;
                formulaToggle.addEventListener('change', (event) => {
                    GlobalShowFormulaAnnotations = event.target.checked;
                    const activeTabContent = document.querySelector('.tab-content.active');
                    if (activeTabContent) {
                        const diagramContainer = activeTabContent.querySelector('.diagram-svg-container');
                        if (diagramContainer && diagramInstances[diagramContainer.id]) {
                            diagramInstances[diagramContainer.id].showFormulas = GlobalShowFormulaAnnotations;
                            diagramInstances[diagramContainer.id].render(); 
                        }
                    }
                    showMessage(`Mostrar fórmulas ${GlobalShowFormulaAnnotations ? 'activado' : 'desactivado'}.`);
                });
            }


            try {
                const ex1 = new LinearRegressionExample();
                const ex2 = new SimpleNeuronExample();
                const ex3 = new GradientDescent2DExample();
                const ex4 = new MultiPerceptronExample(); 
            } catch (e) {
                console.error("Error al inicializar uno o más ejemplos:", e);
                showMessage("Error al inicializar ejemplos interactivos. Ver consola.", 5000);
            }
            
            if (window.MathJax && typeof window.MathJax.typesetPromise === 'function') {
                ['explanation-ex1', 'explanation-ex2', 'explanation-ex3', 'explanation-ex4'].forEach(id => {
                    const explanationSection = document.getElementById(id);
                    if (explanationSection && !explanationSection.getAttribute('data-mathjax-typeset')) {
                        MathJax.typesetPromise([explanationSection])
                            .then(() => explanationSection.setAttribute('data-mathjax-typeset', 'true'))
                            .catch(err => console.error(`Error MathJax en ${id}:`, err));
                    }
                });
            }
        });

[end of retropropagacion/retropropagacion.js]
