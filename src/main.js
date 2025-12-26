const page = window.location.pathname;

if (page.includes("game.html")) {
    const URL_PARAM = new URLSearchParams(window.location.search);
    const MODEL_URL = URL_PARAM.get('modelUrl');

    let model, webcam, ctx, labelContainer, selectedLabel, probabilityBar;
    let score = 0;
    let timeLeft = 180;
    let labels = [];
    let selectedLabelName = null;
    let completedLabels = [];
    let capturedPoses = []; // ADDED: To store captures

    const scoreElement = document.getElementById('score');
    const timerElement = document.getElementById('timer');

    async function init() {
        if (!MODEL_URL) {
            alert("Model URL not found!");
            window.location.href = "init.html";
            return;
        }

        const modelURL = MODEL_URL + "model.json";
        const metadataURL = MODEL_URL + "metadata.json";

        try {
            model = await tmPose.load(modelURL, metadataURL);
            labels = model.getClassLabels();
        } catch (e) {
            console.error(e);
            alert("Failed to load model. Please check the URL and try again.");
            window.location.href = "init.html";
            return;
        }

        const size = 400;
        const flip = true;
        webcam = new tmPose.Webcam(size, size, flip);
        await webcam.setup();
        await webcam.play();
        window.requestAnimationFrame(loop);

        const canvas = document.getElementById("canvas");
        canvas.width = size;
        canvas.height = size;
        ctx = canvas.getContext("2d");
        labelContainer = document.getElementById("label-container");
        selectedLabel = document.getElementById("selected-label");
        probabilityBar = document.getElementById("probability-bar");

        renderLabels();
        startTimer();
    }

    function renderLabels() {
        labelContainer.innerHTML = "";
        labels.forEach(label => {
            const button = document.createElement("button");
            button.innerText = label;
            button.disabled = completedLabels.includes(label);
            if (completedLabels.includes(label)) {
                button.style.backgroundColor = "grey";
            }
            button.addEventListener("click", () => selectLabel(label));
            labelContainer.appendChild(button);
        });
    }

    function selectLabel(label) {
        selectedLabelName = label;
        selectedLabel.innerText = label;
    }

    function startTimer() {
        const timerInterval = setInterval(() => {
            timeLeft--;
            timerElement.innerText = `Time: ${timeLeft}`;
            if (timeLeft <= 0) {
                clearInterval(timerInterval);
                endGame();
            }
        }, 1000);
    }

    let isPaused = false;
    const captureContainer = document.getElementById('capture-container');
    const capturedImage = document.getElementById('captured-image');

    async function loop() {
        if (isPaused) {
            window.requestAnimationFrame(loop);
            return;
        }
        webcam.update();
        await predict();
        window.requestAnimationFrame(loop);
    }

    async function predict() {
        const {
            pose,
            posenetOutput
        } = await model.estimatePose(webcam.canvas);
        const prediction = await model.predict(posenetOutput);

        if (selectedLabelName) {
            const selectedPrediction = prediction.find(p => p.className === selectedLabelName);
            if (selectedPrediction) {
                const probability = selectedPrediction.probability;
                probabilityBar.style.width = `${probability * 100}%`;

                if (probability > 0.7) {
                    isPaused = true;
                    score++;
                    scoreElement.innerText = `Score: ${score}`;

                    // MODIFIED: Store capture data
                    const captureDataUrl = webcam.canvas.toDataURL();
                    capturedPoses.push({
                        image: captureDataUrl,
                        label: selectedLabelName
                    });
                    
                    capturedImage.src = captureDataUrl;
                    captureContainer.classList.remove('hidden');
                    
                    setTimeout(() => {
                        capturedImage.classList.add('zoom');
                    }, 10);

                    setTimeout(() => {
                        capturedImage.classList.remove('zoom');
                        setTimeout(() => {
                            captureContainer.classList.add('hidden');
                            completedLabels.push(selectedLabelName);
                            selectedLabelName = null;
                            selectedLabel.innerText = "";
                            probabilityBar.style.width = "0%";
                            renderLabels();
                            isPaused = false;
                            if (completedLabels.length === labels.length) {
                                endGame();
                            }
                        }, 500);
                    }, 3000);
                }
            }
        }

        drawPose(pose);
    }

    function drawPose(pose) {
        if (webcam.canvas) {
            ctx.drawImage(webcam.canvas, 0, 0);
            if (pose) {
                const minPartConfidence = 0.5;
                tmPose.drawKeypoints(pose.keypoints, minPartConfidence, ctx);
                tmPose.drawSkeleton(pose.keypoints, minPartConfidence, ctx);
            }
        }
    }

    // MODIFIED: Use sessionStorage
    function endGame() {
        const bonus = Math.floor(timeLeft / 10) * 0.1;
        const finalScore = score + bonus;
        
        sessionStorage.setItem('finalScore', finalScore);
        sessionStorage.setItem('capturedPoses', JSON.stringify(capturedPoses));

        window.location.href = `score.html`;
    }

    init();

} else if (page.includes("init.html")) {
    // MODIFIED: Clear sessionStorage
    document.getElementById('start-button').addEventListener('click', () => {
        sessionStorage.clear(); 
        const modelUrl = document.getElementById('model-url-input').value;
        if (modelUrl) {
            window.location.href = `game.html?modelUrl=${encodeURIComponent(modelUrl)}`;
        } else {
            alert('Please enter a model URL.');
        }
    });

} else if (page.includes("score.html")) {
    // MODIFIED: Read from sessionStorage and display images
    const score = sessionStorage.getItem('finalScore');
    const capturedPoses = JSON.parse(sessionStorage.getItem('capturedPoses'));

    document.getElementById('score').innerText = parseFloat(score).toFixed(1);

    const container = document.getElementById('captured-poses-container');
    if (capturedPoses && capturedPoses.length > 0) {
        capturedPoses.forEach(pose => {
            const poseDiv = document.createElement('div');
            poseDiv.className = 'pose-item';

            const img = document.createElement('img');
            img.src = pose.image;

            const label = document.createElement('p');
            label.innerText = pose.label;

            poseDiv.appendChild(img);
            poseDiv.appendChild(label);
            container.appendChild(poseDiv);
        });
    }

    document.getElementById('play-again-button').addEventListener('click', () => {
        sessionStorage.clear();
        window.location.href = 'init.html';
    });
}
