document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('gradientCanvas');
    const ctx = canvas.getContext('2d');
    const resetButton = document.getElementById('resetButton');
    const lrSlider = document.getElementById('lrSlider');
    const lrDisplay = document.getElementById('lrDisplay');
    const infoText = document.getElementById('infoText');

    // --- Parámetros Configurables ---
    let learningRate = parseFloat(lrSlider.value); // Tasa de aprendizaje inicial desde el slider
    let currentX = getRandomStartX(); // Posición inicial en el eje X
    const targetX = 0; // El mínimo de la función x^2 está en x=0
    const scale = 50; // Escala visual en el canvas
    const offsetX = canvas.width / 2;
    const offsetY = canvas.height * 0.85; // Ajustado para nueva altura y mejor visualización
    const precision = 0.001; // Criterio de convergencia más fino
    const maxHistory = 100; // Máximo de puntos en el historial
    const vectorScale = 2000; // Factor para escalar la longitud del vector de descenso (ajustar según sea necesario)
    const maxVectorLen = 30; // Longitud máxima visual del vector
    // --- Estado de la Animación ---
    let animationFrameId = null;
    let historyPoints = []; // Array para guardar el rastro

    // --- Funciones Matemáticas ---
    // Función a minimizar: f(x) = x^2
    function objectiveFunction(x) {
        return x * x;
    }
    // Gradiente de la función: f'(x) = 2x
    function gradient(x) {
        return 2 * x;
    }

    // --- Funciones Auxiliares ---
    function getRandomStartX() {
        // Devuelve un valor inicial entre -5 y 5, excluyendo la zona cercana al mínimo
        let start = (Math.random() - 0.5) * 10; // Entre -5 y 5
        return Math.abs(start) < 0.5 ? (start < 0 ? -0.5 : 0.5) : start; // Evita empezar muy cerca de 0
    }

    function worldToCanvas(x, y) {
        return {
            x: offsetX + x * scale,
            y: offsetY - y * scale
        };
    }

    function canvasToWorldX(canvasX) {
        return (canvasX - offsetX) / scale;
    }

    // --- Funciones de Dibujo ---
    function drawAxes() {
        ctx.strokeStyle = '#ccc';
        ctx.lineWidth = 1;
        ctx.beginPath();
        // Eje X
        ctx.moveTo(0, offsetY);
        ctx.lineTo(canvas.width, offsetY);
        // Eje Y
        ctx.moveTo(offsetX, 0);
        ctx.lineTo(offsetX, canvas.height);
        ctx.stroke();

        // Marcas en los ejes (opcional)
        ctx.fillStyle = '#aaa';
        ctx.font = '10px Arial';
        for(let x = -Math.floor(offsetX / scale); x <= Math.floor(offsetX / scale); x++) {
             if (x === 0) continue;
             const pos = worldToCanvas(x, 0);
             ctx.fillText(x.toString(), pos.x - (x < 0 ? 8: 4) , pos.y + 12);
             ctx.fillRect(pos.x - 0.5, pos.y - 2, 1, 4); // Tick mark
        }
    }

    function drawFunctionCurve() {
        ctx.strokeStyle = '#3498db'; // Azul
        ctx.lineWidth = 2;
        ctx.beginPath();
        let firstPoint = true;
        for (let plotX = -offsetX / scale; plotX <= (canvas.width - offsetX) / scale; plotX += 0.05) {
            const canvasCoords = worldToCanvas(plotX, objectiveFunction(plotX));
            if (firstPoint) {
                ctx.moveTo(canvasCoords.x, canvasCoords.y);
                firstPoint = false;
            } else {
                ctx.lineTo(canvasCoords.x, canvasCoords.y);
            }
        }
        ctx.stroke();
    }

    function drawHistory() {
        for (let i = 0; i < historyPoints.length; i++) {
            const point = historyPoints[i];
            const alpha = 0.1 + 0.7 * (i / historyPoints.length); // Fade out older points
            ctx.fillStyle = `rgba(230, 126, 34, ${alpha})`; // Naranja semi-transparente
            ctx.beginPath();
            ctx.arc(point.x, point.y, 2, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    function drawCurrentPointAndVector(x) {
        const y = objectiveFunction(x);
        const canvasPos = worldToCanvas(x, y);

        // Dibujar el punto actual
        ctx.fillStyle = '#e74c3c'; // Rojo
        ctx.beginPath();
        ctx.arc(canvasPos.x, canvasPos.y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#c0392b'; // Borde más oscuro
        ctx.lineWidth = 1;
        ctx.stroke();


        // Calcular y dibujar el vector de descenso (opuesto al gradiente)
        const grad = gradient(x);
        const descentDirX = -grad; // Dirección opuesta al gradiente
        // No hay componente Y en el gradiente de f(x)=x^2, pero visualizamos la dirección del *paso*
        // La longitud visual del vector será proporcional al cambio en X
        let vectorLen = Math.abs(descentDirX * learningRate * vectorScale);
        vectorLen = Math.min(vectorLen, maxVectorLen); // Limitar longitud visual

        if (vectorLen > 1) { // Solo dibujar si es visible
             const angle = descentDirX > 0 ? 0 : Math.PI; // Apunta a la derecha si grad < 0, izquierda si grad > 0

             ctx.strokeStyle = '#2ecc71'; // Verde para el vector de descenso
             ctx.lineWidth = 2;
             ctx.beginPath();
             ctx.moveTo(canvasPos.x, canvasPos.y);
             const endX = canvasPos.x + vectorLen * Math.cos(angle);
             const endY = canvasPos.y; // El paso es solo horizontal en este caso
             ctx.lineTo(endX, endY);

             // Punta de la flecha (simple)
             const arrowSize = 5;
             ctx.lineTo(endX - arrowSize * Math.cos(angle - Math.PI / 6), endY - arrowSize * Math.sin(angle - Math.PI / 6));
             ctx.moveTo(endX, endY);
             ctx.lineTo(endX - arrowSize * Math.cos(angle + Math.PI / 6), endY - arrowSize * Math.sin(angle + Math.PI / 6));

             ctx.stroke();
        }


        // Mostrar info del punto actual
        ctx.fillStyle = '#333';
        ctx.font = '12px Arial';
        ctx.textAlign = 'left';
        ctx.fillText(`x = ${x.toFixed(3)}`, canvasPos.x + 10, canvasPos.y - 10);
        ctx.fillText(`f(x) = ${y.toFixed(3)}`, canvasPos.x + 10, canvasPos.y + 5);
        ctx.fillText(`∇f(x) = ${grad.toFixed(3)}`, canvasPos.x + 10, canvasPos.y + 20);
    }

    // --- Función Principal de Dibujo ---
    function draw() {
        // Limpiar canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        drawAxes();
        drawFunctionCurve();
        drawHistory(); // Dibujar rastro antes del punto actual
        drawCurrentPointAndVector(currentX);
    }

    // --- Lógica de la Animación ---
    function update() {
        const grad = gradient(currentX);
        const previousX = currentX;

        // Guardar posición actual (en coords de canvas) para el historial ANTES de actualizar
        const currentCanvasPos = worldToCanvas(currentX, objectiveFunction(currentX));
        historyPoints.push({ x: currentCanvasPos.x, y: currentCanvasPos.y });
        if (historyPoints.length > maxHistory) {
            historyPoints.shift(); // Eliminar el punto más antiguo
        }

        // Actualizar posición usando Descenso de Gradiente
        currentX = currentX - learningRate * grad;

        draw(); // Volver a dibujar todo

        // Condición de parada
        const change = Math.abs(currentX - previousX);
        const distToTarget = Math.abs(currentX - targetX);

        if (change < precision || distToTarget < precision / 10) {
             console.log(`Convergencia alcanzada en x = ${currentX.toFixed(4)} (cambio: ${change.toFixed(5)})`);
             infoText.textContent = `Convergencia alcanzada en x ≈ ${currentX.toFixed(3)}`;
             cancelAnimationFrame(animationFrameId); // Detener la animación
             animationFrameId = null;
             return;
        }

        // Solicitar el siguiente frame
        animationFrameId = requestAnimationFrame(update);
    }

    // Iniciar/Reiniciar la animación
    function startAnimation(startX = null) {
        // Cancelar cualquier animación previa
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }

        // Reiniciar estado
        currentX = (startX !== null) ? startX : getRandomStartX();
        historyPoints = []; // Limpiar historial
        learningRate = parseFloat(lrSlider.value); // Asegurar que usa el valor actual del slider
        lrDisplay.textContent = learningRate.toFixed(3); // Actualizar display
        infoText.textContent = `Iniciando desde x ≈ ${currentX.toFixed(2)}. Tasa Aprendizaje: ${learningRate.toFixed(3)}`;
        console.log(`Iniciando animación desde x = ${currentX.toFixed(3)} con LR = ${learningRate}`);

        draw(); // Dibujar estado inicial inmediatamente

        // Empezar el bucle de animación
        animationFrameId = requestAnimationFrame(update);
    }

    // --- Event Listeners ---
    resetButton.addEventListener('click', () => startAnimation());

    lrSlider.addEventListener('input', () => {
        learningRate = parseFloat(lrSlider.value);
        lrDisplay.textContent = learningRate.toFixed(3);
         // Si la animación está corriendo, la nueva LR se usará en el próximo paso 'update'
         // Si no está corriendo, actualizamos el texto informativo
         if (!animationFrameId) {
             infoText.textContent = `Tasa de Aprendizaje ajustada a ${learningRate.toFixed(3)}. Haz clic o reinicia.`;
             // Podríamos redibujar el vector estático si quisiéramos: draw();
         } else {
              infoText.textContent = `Descendiendo... Tasa Aprendizaje: ${learningRate.toFixed(3)}`;
         }
    });

    canvas.addEventListener('click', (event) => {
        const rect = canvas.getBoundingClientRect();
        const canvasX = event.clientX - rect.left;
        // const canvasY = event.clientY - rect.top; // No necesitamos Y para iniciar

        const clickedWorldX = canvasToWorldX(canvasX);

        // Opcional: Limitar el rango donde se puede iniciar
        const maxStartX = (canvas.width - offsetX) / scale * 0.95; // Un poco dentro de los bordes
        const minStartX = -offsetX / scale * 0.95;
        const clampedX = Math.max(minStartX, Math.min(maxStartX, clickedWorldX));

        console.log(`Clic detectado en canvas (${canvasX.toFixed(0)}), corresponde a x ≈ ${clampedX.toFixed(3)}`);
        startAnimation(clampedX); // Iniciar animación desde el punto clickeado
    });

    // --- Inicio ---
    startAnimation(); // Iniciar la animación al cargar la página

});