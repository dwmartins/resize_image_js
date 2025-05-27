document.addEventListener('DOMContentLoaded', function () {
    const imagesInput = document.getElementById('images');
    const previewContainer = document.getElementById('previewContainer');
    const resizeBtn = document.getElementById('resizeBtn');
    const progressContainer = document.getElementById('progressContainer');
    const progressBar = document.getElementById('progressBar');
    const progressPercent = document.getElementById('progressPercent');
    const statusDiv = document.getElementById('status');
    const maintainRatioCheckbox = document.getElementById('maintainRatio');

    // Adicionar JSZip e FileSaver.js dinamicamente
    const loadScript = (src) => new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });

    const qualityRange = document.getElementById('quality');
    const qualityValue = document.getElementById('qualityValue');

    qualityRange.addEventListener('input', function() {
        qualityValue.textContent = this.value;
    });

    // Preview das imagens selecionadas
    imagesInput.addEventListener('change', function (e) {
        previewContainer.innerHTML = '';

        if (this.files && this.files.length > 0) {
            Array.from(this.files).forEach(file => {
                if (!file.type.match('image.*')) return;

                const reader = new FileReader();
                reader.onload = function (e) {
                    const colDiv = document.createElement('div');
                    colDiv.className = 'col-md-2 col-sm-6';

                    const previewItem = document.createElement('div');
                    previewItem.className = 'preview-item';

                    const img = document.createElement('img');
                    img.src = e.target.result;
                    img.className = 'preview-img';
                    img.alt = 'Preview';

                    const fileName = document.createElement('div');
                    fileName.className = 'small text-muted text-truncate';
                    fileName.textContent = file.name;

                    const fileSize = document.createElement('div');
                    fileSize.className = 'small text-muted';
                    fileSize.textContent = formatFileSize(file.size);

                    const originalDimensions = document.createElement('div');
                    originalDimensions.className = 'small text-muted';

                    const imgTemp = new Image();
                    imgTemp.onload = function () {
                        originalDimensions.textContent = `${imgTemp.width} × ${imgTemp.height} px`;
                    };
                    imgTemp.src = e.target.result;

                    const removeBtn = document.createElement('button');
                    removeBtn.className = 'btn btn-danger btn-sm remove-btn';
                    removeBtn.innerHTML = '<i class="bi bi-x"></i>';
                    removeBtn.onclick = function () {
                        colDiv.remove();
                    };

                    previewItem.appendChild(removeBtn);
                    previewItem.appendChild(img);
                    previewItem.appendChild(fileName);
                    previewItem.appendChild(fileSize);
                    previewItem.appendChild(originalDimensions);
                    colDiv.appendChild(previewItem);
                    previewContainer.appendChild(colDiv);
                };
                reader.readAsDataURL(file);
            });
        }
    });

    // Processar imagens e criar ZIP
    resizeBtn.addEventListener('click', async function () {
        // Carregar bibliotecas necessárias
        try {
            await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js');
            await loadScript('https://cdnjs.cloudflare.com/ajax/libs/FileSaver.js/2.0.5/FileSaver.min.js');
        } catch (error) {
            showAlert('Erro ao carregar bibliotecas necessárias', 'danger');
            console.error(error);
            return;
        }

        const files = imagesInput.files;
        const targetWidth = parseInt(document.getElementById('width').value);
        const targetHeight = parseInt(document.getElementById('height').value);
        const quality = parseInt(document.getElementById('quality').value);
        const maintainRatio = maintainRatioCheckbox.checked;

        if (!files || files.length === 0) {
            showAlert('Por favor, selecione pelo menos uma imagem.', 'danger');
            return;
        }

        progressContainer.style.display = 'block';
        updateProgress(0, 'Iniciando processamento...');

        try {
            const zip = new JSZip();
            const imgFolder = zip.folder("imagens_redimensionadas");
            let processedCount = 0;

            // Processar cada imagem
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                if (!file.type.match('image.*')) continue;

                updateProgress(
                    Math.round((i / files.length) * 100),
                    `Processando ${i + 1} de ${files.length}: ${file.name}`
                );

                // Redimensionar a imagem
                const resizedImageBlob = await resizeImage(
                    file,
                    targetWidth,
                    targetHeight,
                    quality,
                    maintainRatio
                );

                // Adicionar ao ZIP
                const fileName = file.name.replace(/\.[^/.]+$/, "") + "_resized.jpg";
                imgFolder.file(fileName, resizedImageBlob);
                processedCount++;

                // Atualizar preview com a imagem redimensionada
                updateImagePreview(file, URL.createObjectURL(resizedImageBlob));
            }

            if (processedCount === 0) {
                throw new Error('Nenhuma imagem foi processada com sucesso.');
            }

            updateProgress(100, 'Criando arquivo ZIP...');

            // Gerar o arquivo ZIP
            const zipContent = await zip.generateAsync({type: 'blob'}, (metadata) => {
                updateProgress(
                    Math.round(metadata.percent),
                    `Compactando: ${metadata.percent.toFixed(2)}%`
                );
            });

            // Salvar o ZIP
            saveAs(zipContent, 'imagens_redimensionadas.zip');

            updateProgress(100, 'Download iniciado!');
            showAlert(`${processedCount} imagem(ns) processada(s) com sucesso! O download do ZIP começará automaticamente.`, 'success');
        } catch (error) {
            updateProgress(0, 'Erro no processamento');
            showAlert('Erro: ' + error.message, 'danger');
            console.error(error);
        }
    });

    // Função para redimensionar imagem
    function resizeImage(file, targetWidth, targetHeight, quality, maintainRatio) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = function (e) {
                const img = new Image();
                img.onload = function () {
                    const canvas = document.createElement('canvas');
                    let finalWidth, finalHeight;

                    if (maintainRatio) {
                        // Manter proporção original
                        const ratio = img.width / img.height;

                        // Verificar qual dimensão é o fator limitante
                        if (targetWidth / targetHeight > ratio) {
                            finalWidth = targetHeight * ratio;
                            finalHeight = targetHeight;
                        } else {
                            finalWidth = targetWidth;
                            finalHeight = targetWidth / ratio;
                        }
                    } else {
                        // Usar exatamente as dimensões solicitadas (pode distorcer)
                        finalWidth = targetWidth;
                        finalHeight = targetHeight;
                    }

                    canvas.width = finalWidth;
                    canvas.height = finalHeight;

                    const ctx = canvas.getContext('2d');
                    ctx.imageSmoothingQuality = 'high';
                    ctx.drawImage(img, 0, 0, finalWidth, finalHeight);

                    // Converter qualidade de 1-10 para 0.1-1.0
                    const actualQuality = quality / 10;

                    // Converter para blob
                    canvas.toBlob(function (blob) {
                        if (!blob) {
                            reject(new Error('Falha ao converter imagem'));
                            return;
                        }
                        resolve(blob);
                    }, 'image/jpeg', actualQuality); // Usando actualQuality convertido
                };
                img.onerror = () => reject(new Error('Falha ao carregar imagem'));
                img.src = e.target.result;
            };
            reader.onerror = () => reject(new Error('Falha ao ler arquivo'));
            reader.readAsDataURL(file);
        });
    }

    // Atualizar preview com imagem redimensionada
    function updateImagePreview(file, resizedUrl) {
        const previewItems = previewContainer.querySelectorAll('.preview-item');

        for (const item of previewItems) {
            const fileNameDiv = item.querySelector('.text-truncate');
            if (fileNameDiv.textContent === file.name) {
                const img = item.querySelector('img');
                img.src = resizedUrl;

                // Atualizar informações de tamanho
                const imgTemp = new Image();
                imgTemp.onload = function () {
                    const dimensionsDiv = item.querySelectorAll('.small.text-muted')[1];
                    dimensionsDiv.textContent = `${imgTemp.width} × ${imgTemp.height} px (redimensionada)`;
                };
                imgTemp.src = resizedUrl;
                break;
            }
        }
    }

    function updateProgress(percent, message) {
        progressBar.style.width = percent + '%';
        progressPercent.textContent = percent + '%';
        if (message) {
            statusDiv.textContent = message;
        }
    }

    function showAlert(message, type) {
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type} alert-dismissible fade show mt-3`;
        alertDiv.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        `;

        // Remove alerts antigos
        const oldAlerts = document.querySelectorAll('.alert');
        oldAlerts.forEach(alert => alert.remove());

        progressContainer.parentNode.insertBefore(alertDiv, progressContainer.nextSibling);
    }

    function formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
});