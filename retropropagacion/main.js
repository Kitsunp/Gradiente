window.MathJax = {
            tex: {
                inlineMath: [['$', '$'], ['\\\\(', '\\\\)']],
                displayMath: [['$$', '$$'], ['\\\\[', '\\\\]']]
            },
            svg: {
                fontCache: 'global'
            },
            startup: {
                ready: () => {
                    console.log('MathJax está listo.');
                    MathJax.startup.defaultReady();
                    const introSection = document.getElementById('introduction');
                    if (introSection) {
                        MathJax.typesetPromise([introSection]).catch((err) => console.error('Error MathJax en intro:', err));
                    }
                    const activeTabContent = document.querySelector('.tab-content.active');
                    if (activeTabContent) {
                        MathJax.typesetPromise([activeTabContent]).catch((err) => console.error('Error MathJax en pestaña activa inicial:', err));
                    }
                    ['explanation-ex1', 'explanation-ex2', 'explanation-ex3', 'explanation-ex4'].forEach(id => {
                        const explanationSection = document.getElementById(id);
                        if (explanationSection) MathJax.typesetPromise([explanationSection]);
                    });
                }
            }
        };

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

        // --- Funciones Generadoras de Estructuras (Fase 2 - Ejemplo) ---
        function generateDetailedNeuronStructure(idPrefix, originX, originY) {
            // Genera nodos y conexiones para una neurona detallada como en el Subtema 1.
            // Devuelve un objeto { nodes: [], connections: [] }
            // Los IDs de nodos y conexiones se prefijarán con idPrefix.
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
        // --- Fin Generadores ---


        class InteractiveDiagram {
            constructor(svgContainerId, diagramData) {
                this.container = document.getElementById(svgContainerId);
                if (!this.container) {
                    console.error(`Contenedor de diagrama SVG con ID ${svgContainerId} no encontrado.`);
                    return;
                }
                this.diagramData = diagramData; // Puede incluir nodos y conexiones generados
                this.svg = null; 
                this.currentStateIndex = 0;
                this.stateDescriptionElement = this.container.parentElement.querySelector('.diagram-state-description');
                this.showFormulas = GlobalShowFormulaAnnotations; // Usar la variable global

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
                return { ...template, ...(node.style || {}) }; // Estilos específicos del nodo sobrescriben la plantilla
            }

            getConnectionStyle(conn, isHighlighted) {
                let template = { ...connectionTemplates.default };
                if (isHighlighted) {
                    template = { ...template, ...connectionTemplates.highlighted };
                }
                if (conn.dashed) {
                    template = { ...template, ...connectionTemplates.dashed };
                }
                if (conn.type === 'errorFlow') { // Ejemplo de un tipo de conexión con estilo propio
                     template = { ...template, ...connectionTemplates.errorFlow };
                }
                return { ...template, ...(conn.style || {}) }; // Estilos específicos de la conexión sobrescriben
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
                    highlightedNodeIds = new Set(currentState.highlightedNodes || []);
                    highlightedConnectionIds = new Set(currentState.highlightedConnections || []);
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
                            opacity: (this.diagramData.states && !isHighlighted && highlightedConnectionIds.size > 0) ? 0.3 : 1,
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
                                opacity: (this.diagramData.states && !isHighlighted && highlightedConnectionIds.size > 0) ? 0.5 : 1,
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
                        fill: isHighlighted ? style.stroke : style.fill, // Highlight fill with stroke color
                        stroke: style.stroke, 'stroke-width': isHighlighted ? 2.5 : style['stroke-width'],
                        opacity: (this.diagramData.states && !isHighlighted && highlightedNodeIds.size > 0) ? 0.4 : 1
                    });
                    this.svg.appendChild(circle);
                    
                    const text = createSvgElementUtility('text', {
                        x: node.x, y: node.y, 'text-anchor': 'middle', 'dominant-baseline': 'central',
                        'font-size': style.fontSize, fill: isHighlighted ? 'white' : style.textColor,
                        'font-weight': isHighlighted ? 'bold' : 'normal',
                         opacity: (this.diagramData.states && !isHighlighted && highlightedNodeIds.size > 0) ? 0.6 : 1
                    });
                    text.textContent = node.label;
                    this.svg.appendChild(text);
                });

                // Renderizar anotaciones de fórmulas
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
                                default: // Usa x,y si están definidos, sino posiciona cerca del nodo
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
                            class: 'formula-annotation' // Aplicar clase CSS
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

            updateViewBox() { /* ... (sin cambios) ... */ }
            nextState() { /* ... (sin cambios) ... */ }
            prevState() { /* ... (sin cambios) ... */ }
            updateStateControls() { /* ... (sin cambios) ... */ }
            enableInteractions() { /* ... (sin cambios) ... */ }
            // (Los métodos updateViewBox, nextState, prevState, updateStateControls, enableInteractions permanecen igual que en la v2)
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
                        const svgRect = this.svg.getBoundingClientRect();
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

        // Ejemplo de cómo se usaría el generador para el Subtema 1
        const detailedNeuronStructure = generateDetailedNeuronStructure('s1_neuron', 50, 110);

        const subtopicsData = [ 
            {
                title: "1. Redes y Aprendizaje",
                content: `
                    <h3>1. Introducción a las Redes Neuronales y la Necesidad de Aprender</h3>
                    <p>Una red neuronal es un modelo computacional inspirado en la estructura y función del cerebro humano. Consiste en unidades interconectadas llamadas <strong class='text-blue-600'>neuronas</strong>, organizadas en <strong class='text-blue-600'>capas</strong> (entrada, ocultas, salida).</p>
                    <p>El <strong class='text-blue-600'>aprendizaje</strong> en una red neuronal implica ajustar los <strong class='text-blue-600'>pesos</strong> (fuerza de las conexiones) y <strong class='text-blue-600'>sesgos</strong> (biases) de estas neuronas para que la red pueda realizar una tarea específica.</p>
                    <p>Cada neurona calcula una suma ponderada de sus entradas, le añade un sesgo, y luego pasa el resultado a través de una <strong class='text-blue-600'>función de activación</strong> no lineal.</p>
                    <div class="math-formula">Suma ponderada: $z = \\sum_{i} w_i x_i + b$</div>
                    <div class="math-formula">Activación: $a = \\sigma(z)$</div>
                    <p class="text-sm text-gray-600">Diagrama interactivo (use los botones para ver los pasos):</p>
                `,
                diagramDefinition: { 
                    title: "Neurona Detallada",
                    viewBox: "0 0 400 230", 
                    nodes: detailedNeuronStructure.nodes, // Usando el generador
                    connections: detailedNeuronStructure.connections, // Usando el generador
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
                        {
                            description: "El sesgo (b) también es una entrada ponderada (peso b, entrada 1).",
                            highlightedNodes: [`s1_neuron_bias_in`, `s1_neuron_sum_node`],
                            highlightedConnections: [`s1_neuron_c_bias`],
                            formulaAnnotations: [
                                { elementId: `s1_neuron_bias_in`, text: "1 (bias input)", position: 'left', dx: -5},
                                { elementId: `s1_neuron_c_bias`, text: "b", position: 'bottom', dy: 5},
                            ]
                        },
                        {
                            description: "Suma ponderada: z = w₁x₁ + w₂x₂ + b.",
                            highlightedNodes: [`s1_neuron_in1`, `s1_neuron_in2`, `s1_neuron_bias_in`, `s1_neuron_sum_node`],
                            highlightedConnections: [`s1_neuron_c1`, `s1_neuron_c2`, `s1_neuron_c_bias`, `s1_neuron_c_sum_act`],
                            formulaAnnotations: [
                                { elementId: `s1_neuron_sum_node`, text: "z", position: 'right', dx: 5},
                            ]
                        },
                        {
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
            // ... (Resto de los subtemas como en v2, pero ahora pueden añadir `formulaAnnotations` a sus estados)
            // Asegúrate de que los IDs en `formulaAnnotations` coincidan con los IDs de los nodos/conexiones
            // en las definiciones de diagramas (incluyendo los generados).
            {
                title: "2. Función de Pérdida",
                content: `
                    <h3>2. La Función de Pérdida (Costo): Midiendo el Error</h3>
                    <p>Para que una red aprenda, necesitamos una forma de medir qué tan bien (o mal) está realizando su tarea. Esto se hace mediante una <strong class='text-blue-600'>función de pérdida</strong> (o función de costo).</p>
                    <p>La función de pérdida compara las predicciones de la red ($y_{pred}$) con los valores verdaderos ($y_{true}$) y devuelve un número que representa el error. El objetivo del entrenamiento es minimizar este valor.</p>
                    <p>Ejemplos comunes:</p>
                    <ul class='list-disc list-inside ml-4'>
                        <li><strong class='text-gray-700'>Error Cuadrático Medio (MSE):</strong> Usado comúnmente en problemas de regresión.
                            <div class="math-formula">MSE: $L(y_{true}, y_{pred}) = \\\\frac{1}{N} \\\\sum_{i=1}^{N} (y_{true,i} - y_{pred,i})^2$</div>
                        </li>
                        <li><strong class='text-gray-700'>Entropía Cruzada (Cross-Entropy):</strong> Usada comúnmente en problemas de clasificación.
                            <div class="math-formula">Entropía Cruzada (binaria): $L = -[y_{true} \\\\log(y_{pred}) + (1-y_{true}) \\\\log(1-y_{pred})]$</div>
                        </li>
                    </ul>
                    <p class="text-sm text-gray-600">Diagrama interactivo (MSE para un dato):</p>
                `,
                diagramDefinition: {
                    title: "Función de Pérdida (MSE - un dato)",
                    viewBox: "0 0 450 250",
                    nodes: [
                        { id: 'ypred_mse', label: 'ŷ', type: 'input', x: 50, y: 80 },
                        { id: 'ytrue_mse', label: 'y', type: 'input', x: 50, y: 160 },
                        { id: 'subtract_mse', label: '-', type: 'sum', x: 180, y: 120 }, 
                        { id: 'square_mse', label: 'x²', type: 'sum', x: 300, y: 120 },
                        { id: 'loss_mse', label: 'L', type: 'output', x: 400, y: 120 }
                    ],
                    connections: [
                        { id: 'c1_mse', from: 'ypred_mse', to: 'subtract_mse', label: 'ŷ', arrow: true },
                        { id: 'c2_mse', from: 'ytrue_mse', to: 'subtract_mse', label: 'y', arrow: true },
                        { id: 'c3_mse', from: 'subtract_mse', to: 'square_mse', label: 'error', arrow: true }, // 'y - ŷ'
                        { id: 'c4_mse', from: 'square_mse', to: 'loss_mse', label: 'error²', arrow: true } // '(y - ŷ)²'
                    ],
                    states: [
                        { 
                            description: "Entradas: predicción (ŷ) y valor real (y).",
                            highlightedNodes: ['ypred_mse', 'ytrue_mse'],
                            formulaAnnotations: [
                                {elementId: 'ypred_mse', text: "ŷ", position: 'top'},
                                {elementId: 'ytrue_mse', text: "y", position: 'bottom'}
                            ]
                        },
                        { 
                            description: "Cálculo de la diferencia (error): y - ŷ.",
                            highlightedNodes: ['ypred_mse', 'ytrue_mse', 'subtract_mse'],
                            highlightedConnections: ['c1_mse', 'c2_mse', 'c3_mse'],
                            formulaAnnotations: [
                                {elementId: 'subtract_mse', text: "e = y - ŷ", position: 'bottom', dy: 10}
                            ]
                        },
                        { 
                            description: "Cálculo del error al cuadrado: (y - ŷ)². (Para MSE, usualmente se promedia sobre N muestras).",
                            highlightedNodes: ['subtract_mse', 'square_mse', 'loss_mse'],
                            highlightedConnections: ['c3_mse', 'c4_mse'],
                            formulaAnnotations: [
                                {elementId: 'square_mse', text: "e²", position: 'bottom', dy: 10},
                                {elementId: 'loss_mse', text: "L = ½e² (o e²)", position: 'top'}
                            ]
                        }
                    ]
                }
            },
             {
                title: "3. Descenso del Gradiente",
                // ... (contenido igual)
                 content: `
                    <h3>3. Optimización: El Descenso del Gradiente</h3>
                    <p>El <strong class='text-blue-600'>descenso del gradiente</strong> es el algoritmo de optimización más común para entrenar redes neuronales. Su objetivo es encontrar los valores de los pesos y sesgos que minimizan la función de pérdida.</p>
                    <p>Imagina la función de pérdida como un paisaje montañoso. El descenso del gradiente intenta encontrar el valle más profundo (el mínimo de la función). Lo hace calculando el <strong class='text-blue-600'>gradiente</strong> (la dirección de mayor inclinación) de la función de pérdida con respecto a cada parámetro (peso o sesgo) y luego dando un pequeño paso en la dirección opuesta.</p>
                    <p>La <strong class='text-blue-600'>tasa de aprendizaje ($\\\eta$)</strong> controla el tamaño de estos pasos.</p>
                    <div class="math-formula">Actualización de un peso $w$: $w_{nuevo} = w_{viejo} - \\\\eta \\\\frac{\\\\partial L}{\\\\partial w}$</div>
                    <p class="text-sm text-gray-600">Diagrama interactivo:</p>
                `,
                diagramDefinition: { // Reutilizando la estructura de la v2, añadiendo states y formulaAnnotations
                    title: "Descenso del Gradiente (Actualización)",
                    viewBox: "0 0 500 280",
                    nodes: [
                        { id: 'w_old_gd', label: 'W_viejo', type: 'input', x: 80, y: 100 },
                        { id: 'gradL_gd', label: '∂L/∂W', type: 'input', x: 80, y: 200 }, // Podría ser tipo 'grad'
                        { id: 'eta_gd', label: 'η', type: 'input', x: 200, y: 200 },
                        { id: 'multiply_gd', label: '×', type: 'sum', x: 280, y: 150 }, 
                        { id: 'subtract_gd', label: '-', type: 'sum', x: 400, y: 100 },
                        { id: 'w_new_gd', label: 'W_nuevo', type: 'output', x: 480, y: 100 }
                    ],
                    connections: [
                        { id: 'c1_gd', from: 'gradL_gd', to: 'multiply_gd', arrow: true },
                        { id: 'c2_gd', from: 'eta_gd', to: 'multiply_gd', arrow: true },
                        { id: 'c3_gd', from: 'multiply_gd', to: 'subtract_gd', label: 'ΔW', arrow: true }, // η ∂L/∂W
                        { id: 'c4_gd', from: 'w_old_gd', to: 'subtract_gd', arrow: true },
                        { id: 'c5_gd', from: 'subtract_gd', to: 'w_new_gd', arrow: true}
                    ],
                    states: [
                        { 
                            description: "Componentes: Peso actual (W_viejo), gradiente (∂L/∂W), tasa de aprendizaje (η).",
                            highlightedNodes: ['w_old_gd', 'gradL_gd', 'eta_gd'],
                            formulaAnnotations: [
                                {elementId: 'w_old_gd', text: "W_t", position: 'top'},
                                {elementId: 'gradL_gd', text: "∇L(W_t)", position: 'bottom'},
                                {elementId: 'eta_gd', text: "η", position: 'bottom'}
                            ]
                        },
                        { 
                            description: "Cálculo del cambio: ΔW = η * ∂L/∂W.",
                            highlightedNodes: ['gradL_gd', 'eta_gd', 'multiply_gd'],
                            highlightedConnections: ['c1_gd', 'c2_gd', 'c3_gd'],
                             formulaAnnotations: [
                                {elementId: 'multiply_gd', text: "η∇L(W_t)", position: 'right', dx:10}
                            ]
                        },
                        { 
                            description: "Actualización del peso: W_nuevo = W_viejo - ΔW.",
                            highlightedNodes: ['w_old_gd', 'multiply_gd', 'subtract_gd', 'w_new_gd'],
                            highlightedConnections: ['c3_gd', 'c4_gd', 'c5_gd'],
                            formulaAnnotations: [
                                {elementId: 'w_new_gd', text: "W_t+1", position: 'top'}
                            ]
                        }
                    ]
                }
            },
            // ... (El resto de los subtemas 4 a 9 se mantienen como en la v2, 
            //      pero ahora se puede añadir la propiedad `formulaAnnotations` a sus `states`
            //      para mostrar fórmulas si la opción global está activada.
            //      Se necesitaría definir esas anotaciones cuidadosamente para cada paso.)
            {
                title: "4. Regla de la Cadena",
                content: `
                    <h3>4. La Regla de la Cadena: La Base Matemática</h3>
                    <p>Las redes neuronales son esencialmente funciones compuestas muy grandes. La salida de una neurona es la entrada de otra, y la función de pérdida depende de la salida final de la red. Para calcular cómo un cambio en un peso en una capa temprana afecta la pérdida final, necesitamos la <strong class='text-blue-600'>regla de la cadena</strong> del cálculo diferencial.</p>
                    <p>La regla de la cadena nos dice cómo calcular la derivada de una función compuesta. Si tenemos $y = f(u)$ y $u = g(x)$, entonces la derivada de $y$ con respecto a $x$ es:</p>
                    <div class="math-formula">$\\\\frac{dy}{dx} = \\\\frac{dy}{du} \\\\cdot \\\\frac{du}{dx}$</div>
                    <p>En una red neuronal, la pérdida $L$ es una función de las activaciones de la capa de salida ($a^L$), que son funciones de las sumas ponderadas ($z^L$), que a su vez son funciones de las activaciones de capas anteriores ($a^{L-1}$) y los pesos ($W^L$). La retropropagación aplica sistemáticamente la regla de la cadena.</p>
                    <p class="text-sm text-gray-600">Diagrama interactivo (derivada de $L$ respecto a $W$):</p>
                `,
                diagramDefinition: {
                    title: "Regla de la Cadena: ∂L/∂W",
                    viewBox: "0 0 550 200",
                    nodes: [
                        { id: 'W_rc', label: 'W', type: 'input', x: 50, y: 100 },
                        { id: 'z_rc', label: 'z', type: 'sum', x: 180, y: 100 }, 
                        { id: 'a_rc', label: 'a', type: 'neuron', x: 310, y: 100 }, 
                        { id: 'L_rc', label: 'L', type: 'output', x: 440, y: 100 }  
                    ],
                    connections: [
                        { id: 'c_Wz_rc', from: 'W_rc', to: 'z_rc', label: '∂z/∂W', arrow: true, labelOffset: -10 },
                        { id: 'c_za_rc', from: 'z_rc', to: 'a_rc', label: '∂a/∂z', arrow: true, labelOffset: -10 },
                        { id: 'c_aL_rc', from: 'a_rc', to: 'L_rc', label: '∂L/∂a', arrow: true, labelOffset: -10 }
                    ],
                    states: [
                        { 
                            description: "Paso 1: ∂L/∂a (derivada de la pérdida respecto a la activación 'a')", 
                            highlightedNodes: ['a_rc', 'L_rc'], highlightedConnections: ['c_aL_rc'],
                            formulaAnnotations: [{elementId: 'c_aL_rc', text: "∂L/∂a", position: 'bottom', dy: 5}]
                        },
                        { 
                            description: "Paso 2: (∂L/∂a) ⋅ (∂a/∂z) (se multiplica por la derivada de 'a' respecto a 'z')", 
                            highlightedNodes: ['z_rc', 'a_rc', 'L_rc'], highlightedConnections: ['c_za_rc', 'c_aL_rc'],
                            formulaAnnotations: [
                                {elementId: 'c_aL_rc', text: "∂L/∂a", position: 'bottom', dy: 5},
                                {elementId: 'c_za_rc', text: "∂a/∂z", position: 'bottom', dy: 5}
                            ]
                        },
                        { 
                            description: "Paso 3: (∂L/∂a) ⋅ (∂a/∂z) ⋅ (∂z/∂W) = ∂L/∂W", 
                            highlightedNodes: ['W_rc','z_rc', 'a_rc', 'L_rc'], highlightedConnections: ['c_Wz_rc', 'c_za_rc', 'c_aL_rc'],
                            formulaAnnotations: [
                                {elementId: 'c_aL_rc', text: "∂L/∂a", position: 'bottom', dy: 5},
                                {elementId: 'c_za_rc', text: "∂a/∂z", position: 'bottom', dy: 5},
                                {elementId: 'c_Wz_rc', text: "∂z/∂W", position: 'bottom', dy: 5}
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
                                <li>Se aplica la función de activación ($\\sigma$) a $z^l$ para obtener la activación de la capa $a^l$: $a^l = \\sigma(z^l)$.</li>
                            </ul>
                        </li>
                        <li>La activación de la última capa, $a^L$, es la predicción de la red ($y_{pred}$).</li>
                    </ol>
                    <p>Durante el forward pass, es crucial almacenar los valores intermedios ($z^l, a^l$).</p>
                    <p class="text-sm text-gray-600">Diagrama interactivo (use los botones para ver los pasos):</p>
                `,
                diagramDefinition: { // Definición de la v2, se pueden añadir formulaAnnotations
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
                    states: [ // Los mismos estados, se pueden añadir formulaAnnotations
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
            {
                title: "6. Backward Pass: Capa Salida",
                 content: `
                    <h3>6. Paso hacia Atrás (Backward Propagation): Error en la Capa de Salida</h3>
                    <p>Una vez que tenemos la predicción ($a^L$) y la comparamos con el valor real ($y_{true}$) usando la función de pérdida $L$, comienza el <strong class='text-blue-600'>paso hacia atrás</strong>.</p>
                    <p>El primer paso es calcular cómo la pérdida cambia con respecto a la activación de la capa de salida y con respecto a la suma ponderada $z^L$ de la capa de salida. Definimos el "error" de la capa de salida $\\delta^L$ como:</p>
                    <div class="math-formula">$\\\\delta^L = \\\\frac{\\\\partial L}{\\\\partial a^L} \\\\odot \\\\sigma'(z^L)$</div>
                    <p>Donde $\\\\odot$ representa la multiplicación elemento a elemento (producto Hadamard), y $\\sigma'(z^L)$ es la derivada de la función de activación evaluada en $z^L$.</p>
                    <p>Con $\\delta^L$, podemos calcular los gradientes de la pérdida con respecto a los pesos ($W^L$) y sesgos ($b^L$) de la capa de salida:</p>
                    <div class="math-formula">$\\\\frac{\\\\partial L}{\\\\partial W^L} = \\\\delta^L (a^{L-1})^T$</div>
                    <div class="math-formula">$\\\\frac{\\\\partial L}{\\\\partial b^L} = \\\\delta^L$</div>
                    <p class="text-sm text-gray-600">Diagrama interactivo (use los botones para ver los pasos):</p>
                `,
                diagramDefinition: { // Definición de la v2, se pueden añadir formulaAnnotations
                    title: "Backward Pass (Capa Salida L)",
                    viewBox: "0 0 450 300",
                    nodes: [
                        { id: 'aL-1_bps', label: 'a⁽ᴸ⁻¹⁾', type: 'input', x: 50, y: 100 },
                        { id: 'bL_bps', label: 'b⁽ᴸ⁾', type: 'bias', x: 50, y: 180 },
                        { id: 'zL_bps', label: 'z⁽ᴸ⁾', type: 'sum', x: 180, y: 100 },
                        { id: 'aL_bps', label: 'a⁽ᴸ⁾=ŷ', type: 'neuron', x: 300, y: 100 },
                        { id: 'L_node_bps', label: 'L', type: 'output', x: 400, y: 100 },
                        { id: 'deltaL_bps', label: 'δ⁽ᴸ⁾', type: 'error', x: 300, y: 220 }, 
                        { id: 'dLdW_bps', label: '∂L/∂W⁽ᴸ⁾', type: 'grad', x: 120, y: 220}, 
                        { id: 'dLdb_bps', label: '∂L/∂b⁽ᴸ⁾', type: 'grad', x: 180, y: 260}  
                    ],
                    connections: [
                        { id: 'c_a_z_L_bps', from: 'aL-1_bps', to: 'zL_bps', label: 'W⁽ᴸ⁾', arrow: true },
                        { id: 'c_b_z_L_bps', from: 'bL_bps', to: 'zL_bps', arrow: true },
                        { id: 'c_z_a_L_bps', from: 'zL_bps', to: 'aL_bps', label: 'σ', arrow: true },
                        { id: 'c_a_L_node_bps', from: 'aL_bps', to: 'L_node_bps', arrow: true },
                        { id: 'c_L_delta_bps', from: 'L_node_bps', to: 'deltaL_bps', label: " ", dashed: true, arrow: true, labelOffset: 10 }, // Label en annotation
                        { id: 'c_delta_dLdW_bps', from: 'deltaL_bps', to: 'dLdW_bps', label: ' ', dashed: true, arrow: true }, // Label en annotation
                        { id: 'c_delta_dLdb_bps', from: 'deltaL_bps', to: 'dLdb_bps', dashed: true, arrow: true },
                        { id: 'c_delta_zL_prop_bps', from: 'deltaL_bps', to: 'zL_bps', label: ' ', type:'errorFlow', dashed: true, arrow: true } 
                    ],
                    states: [
                        { title: "BP Salida: Forward (Recordatorio)", description: "Recordatorio del forward pass para la capa L.", highlightedNodes: ['aL-1_bps', 'bL_bps', 'zL_bps', 'aL_bps', 'L_node_bps'], highlightedConnections: ['c_a_z_L_bps', 'c_b_z_L_bps', 'c_z_a_L_bps', 'c_a_L_node_bps'] },
                        { title: "BP Salida: Paso 1 - Cálculo de δ⁽ᴸ⁾", description: "Calcular δ⁽ᴸ⁾ = (∂L/∂a⁽ᴸ⁾) ⊙ σ'(z⁽ᴸ⁾).", highlightedNodes: ['L_node_bps', 'aL_bps', 'zL_bps', 'deltaL_bps'], highlightedConnections: ['c_a_L_node_bps', 'c_L_delta_bps', 'c_z_a_L_bps'],
                          formulaAnnotations: [{elementId: 'c_L_delta_bps', text:"δ⁽ᴸ⁾=(∂L/∂a⁽ᴸ⁾)σ'(z⁽ᴸ⁾)", position:'right', dx:5}]
                        },
                        { title: "BP Salida: Paso 2 - ∂L/∂W⁽ᴸ⁾", description: "Calcular ∂L/∂W⁽ᴸ⁾ = δ⁽ᴸ⁾ (a⁽ᴸ⁻¹⁾)ᵀ.", highlightedNodes: ['deltaL_bps', 'aL-1_bps', 'dLdW_bps'], highlightedConnections: ['c_delta_dLdW_bps', 'c_a_z_L_bps'],
                          formulaAnnotations: [{elementId: 'c_delta_dLdW_bps', text:"(a⁽ᴸ⁻¹⁾)ᵀ", position:'bottom', dy:5}]
                        },
                        { title: "BP Salida: Paso 3 - ∂L/∂b⁽ᴸ⁾", description: "Calcular ∂L/∂b⁽ᴸ⁾ = δ⁽ᴸ⁾.", highlightedNodes: ['deltaL_bps', 'bL_bps', 'dLdb_bps'], highlightedConnections: ['c_delta_dLdb_bps', 'c_b_z_L_bps'],
                          formulaAnnotations: [{elementId: 'dLdb_bps', text:"δ⁽ᴸ⁾", position:'right', dx:5}]
                        },
                        { title: "BP Salida: Propagación Error", description: "δ⁽ᴸ⁾ se usa para calcular errores en capas previas (vía W⁽ᴸ⁾).", highlightedNodes: ['deltaL_bps', 'zL_bps', 'aL-1_bps'], highlightedConnections: ['c_delta_zL_prop_bps', 'c_a_z_L_bps'],
                           formulaAnnotations: [{elementId: 'c_delta_zL_prop_bps', text:"Propagar δ⁽ᴸ⁾", position:'top', dy:-5}]
                        }
                    ]
                }
            },
             {
                title: "7. Backward Pass: Capas Ocultas",
                content: `
                    <h3>7. Paso hacia Atrás: Propagación del Error a Capas Ocultas</h3>
                    <p>Una vez que tenemos el error $\\delta^L$ de la capa de salida, podemos propagarlo hacia atrás para calcular el error $\\delta^l$ para cada capa oculta $l$ (desde $L-1$ hasta la primera capa oculta).</p>
                    <p>El error $\\delta^l$ para una capa oculta $l$ se calcula en función del error de la siguiente capa $\\delta^{l+1}$ y los pesos $W^{l+1}$ que conectan la capa $l$ con la capa $l+1$:</p>
                    <div class="math-formula">$\\\\delta^l = ((W^{l+1})^T \\\\delta^{l+1}) \\\\odot \\\\sigma'(z^l)$</div>
                    <p>Una vez que tenemos $\\delta^l$ para una capa oculta, podemos calcular los gradientes de la pérdida con respecto a los pesos $W^l$ y sesgos $b^l$ de esa capa:</p>
                    <div class="math-formula">$\\\\frac{\\\\partial L}{\\\\partial W^l} = \\\\delta^l (a^{l-1})^T$</div>
                    <div class="math-formula">$\\\\frac{\\\\partial L}{\\\\partial b^l} = \\\\delta^l$</div>
                    <p class="text-sm text-gray-600">Diagrama interactivo (use los botones para ver los pasos):</p>
                `,
                diagramDefinition: { // Definición de la v2, se pueden añadir formulaAnnotations
                    title: "Backward Pass (Capa Oculta l)",
                    viewBox: "0 0 500 320",
                    nodes: [
                        { id: 'al-1_bph', label: 'a⁽ˡ⁻¹⁾', type: 'input', x: 50, y: 150 }, 
                        { id: 'bl_bph', label: 'b⁽ˡ⁾', type: 'bias', x: 50, y: 230 },
                        { id: 'zl_bph', label: 'z⁽ˡ⁾', type: 'sum', x: 180, y: 150 },
                        { id: 'al_bph', label: 'a⁽ˡ⁾', type: 'neuron', x: 300, y: 150 },
                        { id: 'deltal_plus_1_bph', label: 'δ⁽ˡ⁺¹⁾', type: 'error', x: 430, y: 150 },
                        { id: 'deltal_bph', label: 'δ⁽ˡ⁾', type: 'error', x: 300, y: 260 },
                        { id: 'dLdWl_bph', label: '∂L/∂W⁽ˡ⁾', type: 'grad', x: 120, y: 260 },
                        { id: 'dLdbl_bph', label: '∂L/∂b⁽ˡ⁾', type: 'grad', x: 180, y: 300 }
                    ],
                    connections: [
                        { id: 'c_al-1_zl_bph', from: 'al-1_bph', to: 'zl_bph', label: 'W⁽ˡ⁾', arrow: true },
                        { id: 'c_bl_zl_bph', from: 'bl_bph', to: 'zl_bph', arrow: true },
                        { id: 'c_zl_al_bph', from: 'zl_bph', to: 'al_bph', label: 'σ', arrow: true },
                        { id: 'c_al_deltap1_bph', from: 'al_bph', to: 'deltal_plus_1_bph', label: 'W⁽ˡ⁺¹⁾', arrow: true }, 
                        { id: 'c_deltap1_deltal_bph', from: 'deltal_plus_1_bph', to: 'deltal_bph', label: " ", dashed: true, arrow: true, labelOffset: 10 },
                        { id: 'c_deltal_dLdWl_bph', from: 'deltal_bph', to: 'dLdWl_bph', label: ' ', dashed: true, arrow: true },
                        { id: 'c_deltal_dLdbl_bph', from: 'deltal_bph', to: 'dLdbl_bph', dashed: true, arrow: true },
                        { id: 'c_deltal_zl_prop_bph', from: 'deltal_bph', to: 'zl_bph', label: ' ', type:'errorFlow', dashed: true, arrow: true }
                    ],
                    states: [
                        { title: "BP Oculta: Forward (Recordatorio)", description: "Recordatorio del forward pass para la capa l y conexión a l+1.", highlightedNodes: ['al-1_bph', 'bl_bph', 'zl_bph', 'al_bph', 'deltal_plus_1_bph'], highlightedConnections: ['c_al-1_zl_bph', 'c_bl_zl_bph', 'c_zl_al_bph', 'c_al_deltap1_bph'] },
                        { title: "BP Oculta: Paso 1 - Cálculo de δ⁽ˡ⁾", description: "Calcular δ⁽ˡ⁾ = ((W⁽ˡ⁺¹⁾)ᵀ δ⁽ˡ⁺¹⁾) ⊙ σ'(z⁽ˡ⁾).", highlightedNodes: ['deltal_plus_1_bph', 'al_bph', 'zl_bph', 'deltal_bph'], highlightedConnections: ['c_al_deltap1_bph', 'c_deltap1_deltal_bph', 'c_zl_al_bph'],
                          formulaAnnotations: [{elementId: 'c_deltap1_deltal_bph', text:"((W⁽ˡ⁺¹⁾)ᵀδ⁽ˡ⁺¹⁾)σ'(z⁽ˡ⁾)", position:'left', dx:-5}]
                        },
                        { title: "BP Oculta: Paso 2 - ∂L/∂W⁽ˡ⁾", description: "Calcular ∂L/∂W⁽ˡ⁾ = δ⁽ˡ⁾ (a⁽ˡ⁻¹⁾)ᵀ.", highlightedNodes: ['deltal_bph', 'al-1_bph', 'dLdWl_bph'], highlightedConnections: ['c_deltal_dLdWl_bph', 'c_al-1_zl_bph'],
                          formulaAnnotations: [{elementId: 'c_deltal_dLdWl_bph', text:"(a⁽ˡ⁻¹⁾)ᵀ", position:'bottom', dy:5}]
                        },
                        { title: "BP Oculta: Paso 3 - ∂L/∂b⁽ˡ⁾", description: "Calcular ∂L/∂b⁽ˡ⁾ = δ⁽ˡ⁾.", highlightedNodes: ['deltal_bph', 'bl_bph', 'dLdbl_bph'], highlightedConnections: ['c_deltal_dLdbl_bph', 'c_bl_zl_bph'],
                           formulaAnnotations: [{elementId: 'dLdbl_bph', text:"δ⁽ˡ⁾", position:'right', dx:5}]
                        },
                        { title: "BP Oculta: Propagación Error", description: "δ⁽ˡ⁾ se usa para calcular errores en capas previas (vía W⁽ˡ⁾).", highlightedNodes: ['deltal_bph', 'zl_bph', 'al-1_bph'], highlightedConnections: ['c_deltal_zl_prop_bph', 'c_al-1_zl_bph'],
                           formulaAnnotations: [{elementId: 'c_deltal_zl_prop_bph', text:"Propagar δ⁽ˡ⁾", position:'top', dy:-5}]
                        }
                    ]
                }
            },
            { // Subtema 8
                title: "8. Actualización de Pesos",
                content: `
                    <h3>8. Actualización de Pesos y Sesgos</h3>
                    <p>Después de completar el paso hacia atrás (backward pass), hemos calculado los gradientes de la función de pérdida con respecto a todos los pesos ($W^l$) y sesgos ($b^l$) en la red.</p>
                    <p>El siguiente paso es actualizar estos parámetros utilizando la regla del descenso del gradiente:</p>
                    <div class="math-formula">$W^l_{nuevo} = W^l_{viejo} - \\\\eta \\\\frac{\\\\partial L}{\\\\partial W^l}$</div>
                    <div class="math-formula">$b^l_{nuevo} = b^l_{viejo} - \\\\eta \\\\frac{\\\\partial L}{\\\\partial b^l}$</div>
                    <p>Donde $\\\eta$ es la tasa de aprendizaje. Esta actualización se realiza para todos los pesos y sesgos en todas las capas. Todo el proceso (paso hacia adelante, cálculo de la pérdida, paso hacia atrás y actualización de pesos) constituye una <strong class='text-blue-600'>iteración</strong> de entrenamiento.</p>
                    <p class="text-sm text-gray-600">Diagrama interactivo (use los botones para ver los pasos):</p>
                `,
                 diagramDefinition: { // Definición de la v2, se pueden añadir formulaAnnotations
                    title: "Actualización de Peso W",
                    viewBox: "0 0 500 280",
                    nodes: [
                        { id: 'w_old_upd8', label: 'W_viejo', type: 'input', x: 80, y: 100 }, 
                        { id: 'gradL_upd8', label: '∂L/∂W', type: 'grad', x: 80, y: 200 },
                        { id: 'eta_upd8', label: 'η', type: 'input', x: 200, y: 200 },
                        { id: 'multiply_upd8', label: '×', type: 'sum', x: 280, y: 150 }, 
                        { id: 'subtract_upd8', label: '-', type: 'sum', x: 400, y: 100 },
                        { id: 'w_new_upd8', label: 'W_nuevo', type: 'output', x: 480, y: 100 }
                    ],
                    connections: [
                        { id: 'c1_upd8', from: 'gradL_upd8', to: 'multiply_upd8', arrow: true },
                        { id: 'c2_upd8', from: 'eta_upd8', to: 'multiply_upd8', arrow: true },
                        { id: 'c3_upd8', from: 'multiply_upd8', to: 'subtract_upd8', label: 'ΔW', arrow: true },
                        { id: 'c4_upd8', from: 'w_old_upd8', to: 'subtract_upd8', arrow: true },
                        { id: 'c5_upd8', from: 'subtract_upd8', to: 'w_new_upd8', arrow: true}
                    ],
                    states: [
                        { title: "Actualización: Paso 1", description: "Se tienen W_viejo y el gradiente ∂L/∂W.", highlightedNodes: ['w_old_upd8', 'gradL_upd8'],
                          formulaAnnotations: [
                              {elementId: 'w_old_upd8', text: "W_t", position: 'top'},
                              {elementId: 'gradL_upd8', text: "∇L(W_t)", position: 'bottom'}
                          ]
                        },
                        { title: "Actualización: Paso 2", description: "Se multiplica el gradiente por la tasa de aprendizaje η.", highlightedNodes: ['gradL_upd8', 'eta_upd8', 'multiply_upd8'], highlightedConnections: ['c1_upd8', 'c2_upd8', 'c3_upd8'],
                          formulaAnnotations: [
                              {elementId: 'eta_upd8', text: "η", position: 'bottom'},
                              {elementId: 'multiply_upd8', text: "η∇L(W_t)", position: 'right', dx:10}
                          ]
                        },
                        { title: "Actualización: Paso 3", description: "Se resta η ∂L/∂W de W_viejo para obtener W_nuevo.", highlightedNodes: ['w_old_upd8', 'multiply_upd8', 'subtract_upd8', 'w_new_upd8'], highlightedConnections: ['c3_upd8', 'c4_upd8', 'c5_upd8'],
                          formulaAnnotations: [
                              {elementId: 'w_new_upd8', text: "W_t+1 = W_t - η∇L(W_t)", position: 'top'}
                          ]
                        }
                    ]
                }
            },
            { // Subtema 9
                title: "9. Ejemplo Simplificado",
                 content: `
                    <h3>9. Ejemplo Práctico Simplificado (Paso a Paso)</h3>
                    <p>Consideremos una red muy simple: 1 entrada $x$, 1 neurona en una capa oculta con activación $\\sigma_h$, y 1 neurona de salida con activación $\\sigma_o$.</p>
                    <p>Entrada: $x$ | Capa Oculta: $z_h = w_1 x + b_1$, $a_h = \\sigma_h(z_h)$ | Capa de Salida: $z_o = w_2 a_h + b_2$, $a_o = \\hat{y} = \\sigma_o(z_o)$</p>
                    <p>Función de Pérdida (ej. MSE): $L = \\\\frac{1}{2} (y_{true} - \\hat{y})^2$</p>
                    <p><strong>Paso hacia Adelante:</strong> Calcular $z_h, a_h, z_o, \\hat{y}$.</p>
                    <p><strong>Paso hacia Atrás (Gradientes):</strong></p>
                    <div class="math-formula">$\\\\delta_o = (a_o - y_{true}) \\\\sigma_o'(z_o)$</div>
                    <div class="math-formula">$\\\\frac{\\\\partial L}{\\\\partial w_2} = \\\\delta_o a_h \\\\quad ; \\\\quad \\\\frac{\\\\partial L}{\\\\partial b_2} = \\\\delta_o$</div>
                    <div class="math-formula">$\\\\delta_h = (\\\\delta_o w_2) \\\\sigma_h'(z_h)$</div>
                    <div class="math-formula">$\\\\frac{\\\\partial L}{\\\\partial w_1} = \\\\delta_h x \\\\quad ; \\\\quad \\\\frac{\\\\partial L}{\\\\partial b_1} = \\\\delta_h$</div>
                    <p><strong>Actualización:</strong> $w \\leftarrow w - \\eta \\frac{\\partial L}{\\partial w}$, $b \\leftarrow b - \\eta \\frac{\\partial L}{\\partial b}$ para $w_1, b_1, w_2, b_2$.</p>
                    <p class="text-sm text-gray-600">Diagrama interactivo (use los botones para ver los pasos):</p>
                `,
                diagramDefinition: { // Definición de la v2, se pueden añadir formulaAnnotations
                    title: "Red Simple (1-1-1) Flujo Completo",
                    viewBox: "0 0 600 350", 
                    nodes: [
                        { id: 'x_s9', label: 'x', type: 'input', x: 50, y: 100 }, 
                        { id: 'b1_s9', label: 'b₁', type: 'bias', x: 50, y: 160 },
                        { id: 'zh_s9', label: 'zₕ', type: 'sum', x: 150, y: 100 },
                        { id: 'ah_s9', label: 'aₕ', type: 'neuron', x: 250, y: 100 },
                        { id: 'b2_s9', label: 'b₂', type: 'bias', x: 250, y: 160 },
                        { id: 'zo_s9', label: 'zₒ', type: 'sum', x: 350, y: 100 },
                        { id: 'ao_s9', label: 'aₒ=ŷ', type: 'neuron', x: 450, y: 100 },
                        { id: 'L_s9', label: 'L', type: 'output', x: 550, y: 100 },
                        { id: 'delta_o_s9', label: 'δₒ', type: 'error', x: 450, y: 250 },
                        { id: 'dLdw2_s9', label: '∂L/∂w₂', type: 'grad', x: 350, y: 290 },
                        { id: 'dLdb2_s9', label: '∂L/∂b₂', type: 'grad', x: 420, y: 290 },
                        { id: 'delta_h_s9', label: 'δₕ', type: 'error', x: 250, y: 250 },
                        { id: 'dLdw1_s9', label: '∂L/∂w₁', type: 'grad', x: 150, y: 290 },
                        { id: 'dLdb1_s9', label: '∂L/∂b₁', type: 'grad', x: 220, y: 290 }
                    ],
                    connections: [
                        { id: 'c_x_zh_s9', from: 'x_s9', to: 'zh_s9', label: 'w₁', arrow: true },
                        { id: 'c_b1_zh_s9', from: 'b1_s9', to: 'zh_s9', arrow: true },
                        { id: 'c_zh_ah_s9', from: 'zh_s9', to: 'ah_s9', label: 'σₕ', arrow: true },
                        { id: 'c_ah_zo_s9', from: 'ah_s9', to: 'zo_s9', label: 'w₂', arrow: true },
                        { id: 'c_b2_zo_s9', from: 'b2_s9', to: 'zo_s9', arrow: true },
                        { id: 'c_zo_ao_s9', from: 'zo_s9', to: 'ao_s9', label: 'σₒ', arrow: true },
                        { id: 'c_ao_L_s9', from: 'ao_s9', to: 'L_s9', arrow: true },
                        { id: 'c_L_delta_o_s9', from: 'L_s9', to: 'delta_o_s9', label: " ", dashed: true, arrow: true, labelOffset: 10 },
                        { id: 'c_delta_o_dLdw2_s9', from: 'delta_o_s9', to: 'dLdw2_s9', label: ' ', dashed: true, arrow: true },
                        { id: 'c_delta_o_dLdb2_s9', from: 'delta_o_s9', to: 'dLdb2_s9', dashed: true, arrow: true },
                        { id: 'c_delta_o_delta_h_s9', from: 'delta_o_s9', to: 'delta_h_s9', label: " ", dashed: true, arrow: true, labelOffset: 10 },
                        { id: 'c_delta_h_dLdw1_s9', from: 'delta_h_s9', to: 'dLdw1_s9', label: ' ', dashed: true, arrow: true },
                        { id: 'c_delta_h_dLdb1_s9', from: 'delta_h_s9', to: 'dLdb1_s9', dashed: true, arrow: true },
                        { id: 'cdLdw2_zo_s9', from: 'dLdw2_s9', to: 'zo_s9', dashed: true, arrow: false, type:'errorFlow', 'stroke-width': 0.8 },
                        { id: 'cdLdb2_b2_s9', from: 'dLdb2_s9', to: 'b2_s9', dashed: true, arrow: false, type:'errorFlow', 'stroke-width': 0.8 },
                        { id: 'cdLdw1_zh_s9', from: 'dLdw1_s9', to: 'zh_s9', dashed: true, arrow: false, type:'errorFlow', 'stroke-width': 0.8 },
                        { id: 'cdLdb1_b1_s9', from: 'dLdb1_s9', to: 'b1_s9', dashed: true, arrow: false, type:'errorFlow', 'stroke-width': 0.8 }
                    ],
                    states: [
                        { title: "Ej. Simple: Forward - Capa Oculta (zₕ, aₕ)", description: "Cálculo de zₕ = w₁x + b₁ y aₕ = σₕ(zₕ).", highlightedNodes: ['x_s9', 'b1_s9', 'zh_s9', 'ah_s9'], highlightedConnections: ['c_x_zh_s9', 'c_b1_zh_s9', 'c_zh_ah_s9'],
                          formulaAnnotations: [
                              {elementId: 'zh_s9', text: "zₕ=w₁x+b₁", position:'top', dy:-10},
                              {elementId: 'ah_s9', text: "aₕ=σ(zₕ)", position:'top', dy:-10}
                          ]
                        },
                        { title: "Ej. Simple: Forward - Capa Salida (zₒ, aₒ)", description: "Cálculo de zₒ = w₂aₕ + b₂ y aₒ = σₒ(zₒ).", highlightedNodes: ['ah_s9', 'b2_s9', 'zo_s9', 'ao_s9'], highlightedConnections: ['c_ah_zo_s9', 'c_b2_zo_s9', 'c_zo_ao_s9'],
                          formulaAnnotations: [
                              {elementId: 'zo_s9', text: "zₒ=w₂aₕ+b₂", position:'top', dy:-10},
                              {elementId: 'ao_s9', text: "aₒ=σ(zₒ)", position:'top', dy:-10}
                          ]
                        },
                        { title: "Ej. Simple: Forward - Cálculo de Pérdida L", description: "Cálculo de L = ½(y - aₒ)². (y no se muestra).", highlightedNodes: ['ao_s9', 'L_s9'], highlightedConnections: ['c_ao_L_s9'],
                          formulaAnnotations: [{elementId: 'L_s9', text: "L=½(y-aₒ)²", position:'top', dy:-10}]
                        },
                        { title: "Ej. Simple: Backward - δₒ en Capa Salida", description: "Cálculo de δₒ = (aₒ - y)σₒ'(zₒ).", highlightedNodes: ['L_s9', 'ao_s9', 'zo_s9', 'delta_o_s9'], highlightedConnections: ['c_L_delta_o_s9', 'c_zo_ao_s9'],
                          formulaAnnotations: [{elementId: 'c_L_delta_o_s9', text:"δₒ=(aₒ-y)σₒ'(zₒ)", position:'right', dx:5}]
                        },
                        { title: "Ej. Simple: Backward - Gradientes ∂L/∂w₂, ∂L/∂b₂", description: "Cálculo de ∂L/∂w₂ = δₒaₕ y ∂L/∂b₂ = δₒ.", highlightedNodes: ['delta_o_s9', 'ah_s9', 'b2_s9', 'dLdw2_s9', 'dLdb2_s9'], highlightedConnections: ['c_delta_o_dLdw2_s9', 'c_delta_o_dLdb2_s9', 'cdLdw2_zo_s9', 'cdLdb2_b2_s9'],
                          formulaAnnotations: [
                              {elementId: 'c_delta_o_dLdw2_s9', text:"aₕ", position:'bottom', dy:5},
                              {elementId: 'dLdb2_s9', text:"δₒ", position:'left', dx:-5}
                          ]
                        },
                        { title: "Ej. Simple: Backward - δₕ en Capa Oculta", description: "Cálculo de δₕ = (δₒw₂)σₕ'(zₕ).", highlightedNodes: ['delta_o_s9', 'ah_s9', 'zo_s9', 'zh_s9', 'delta_h_s9'], highlightedConnections: ['c_delta_o_delta_h_s9', 'c_ah_zo_s9', 'c_zh_ah_s9'],
                          formulaAnnotations: [{elementId: 'c_delta_o_delta_h_s9', text:"(δₒw₂)σₕ'(zₕ)", position:'left', dx:-5}]
                        },
                        { title: "Ej. Simple: Backward - Gradientes ∂L/∂w₁, ∂L/∂b₁", description: "Cálculo de ∂L/∂w₁ = δₕx y ∂L/∂b₁ = δₕ.", highlightedNodes: ['delta_h_s9', 'x_s9', 'b1_s9', 'dLdw1_s9', 'dLdb1_s9'], highlightedConnections: ['c_delta_h_dLdw1_s9', 'c_delta_h_dLdb1_s9', 'cdLdw1_zh_s9', 'cdLdb1_b1_s9'],
                          formulaAnnotations: [
                              {elementId: 'c_delta_h_dLdw1_s9', text:"x", position:'bottom', dy:5},
                              {elementId: 'dLdb1_s9', text:"δₕ", position:'left', dx:-5}
                          ]
                        },
                        { title: "Ej. Simple: Actualización (Conceptual)", description: "Todos los pesos (w₁, b₁, w₂, b₂) se actualizan usando sus gradientes y η.", highlightedNodes: ['dLdw1_s9', 'dLdb1_s9', 'dLdw2_s9', 'dLdb2_s9'], highlightedConnections: ['cdLdw1_zh_s9', 'cdLdb1_b1_s9', 'cdLdw2_zo_s9', 'cdLdb2_b2_s9'] }
                    ]
                }
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
                             diagramInstances[diagramContainerId].showFormulas = GlobalShowFormulaAnnotations; // Actualizar opción
                             diagramInstances[diagramContainerId].updateViewBox(); 
                             diagramInstances[diagramContainerId].render(); 
                             diagramInstances[diagramContainerId].updateStateControls();
                        }
                    }
                });
            });
            if (subtopicsData[0] && subtopicsData[0].diagramDefinition) {
                const firstDiagramContainerId = `diagram-svg-container-tab-0`;
                 setTimeout(() => { 
                    if (!diagramInstances[firstDiagramContainerId]) {
                         diagramInstances[firstDiagramContainerId] = new InteractiveDiagram(firstDiagramContainerId, subtopicsData[0].diagramDefinition);
                    }
                }, 0);
            }
        }


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
                    // Re-render la pestaña activa si tiene un diagrama
                    const activeTabContent = document.querySelector('.tab-content.active');
                    if (activeTabContent) {
                        const diagramContainer = activeTabContent.querySelector('.diagram-svg-container');
                        if (diagramContainer && diagramInstances[diagramContainer.id]) {
                            diagramInstances[diagramContainer.id].showFormulas = GlobalShowFormulaAnnotations;
                            diagramInstances[diagramContainer.id].render(); // Re-render para aplicar el cambio
                        }
                    }
                    showMessage(`Mostrar fórmulas ${GlobalShowFormulaAnnotations ? 'activado' : 'desactivado'}.`);
                });
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