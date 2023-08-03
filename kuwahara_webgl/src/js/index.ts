import '../scss/styles.scss'
import 'bootstrap';

const inputImage = document.getElementById("inputImage") as HTMLInputElement;
const inputScale = document.getElementById("inputScale") as HTMLInputElement;
const inputBlurRadius = document.getElementById("inputBlurRadius") as HTMLInputElement;
const inputKernelSkew = document.getElementById("inputKernelSkew") as HTMLInputElement;
const inputKernelRadius = document.getElementById("inputKernelRadius") as HTMLInputElement;
const inputSharpness = document.getElementById("inputSharpness") as HTMLInputElement;
const buttonSaveFiltered = document.getElementById("buttonSaveFiltered") as HTMLInputElement;

const inputScaleValue = document.getElementById("inputScaleValue")!;
const inputBlurRadiusValue = document.getElementById("inputBlurRadiusValue")!;
const inputKernelSkewValue = document.getElementById("inputKernelSkewValue")!;
const inputKernelRadiusValue = document.getElementById("inputKernelRadiusValue")!;
const inputSharpnessValue = document.getElementById("inputSharpnessValue")!;

const imagesContainer = document.getElementById("imagesContainer")!;
const imageOriginal = document.getElementById("imageOriginal")!;
const imageStructureTensor = document.getElementById("imageStructureTensor")!;
const imageBlurredStructureTensor = document.getElementById("imageBlurredStructureTensor")!;
const imageAnisotropy = document.getElementById("imageAnisotropy")!;
const imageFiltered = document.getElementById("imageFiltered")!;

const img = new Image();
const canvas = document.getElementById("canvas")! as HTMLCanvasElement;
const gl = canvas.getContext("webgl2")!;
gl.getExtension("EXT_color_buffer_float");

async function createShader(type: number, name: string) {
    const source = (await import(`../shaders/${name}.glsl`)).default as string;

    console.groupCollapsed(`${name} shader source`);
    console.log(source);
    console.groupEnd();

    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    const success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
    if (!success) {
        const infoLog = gl.getShaderInfoLog(shader);
        gl.deleteShader(shader);
        throw infoLog;
    }

    return shader;
}

function createProgram(
    vertexShader: WebGLShader,
    fragmentShader: WebGLShader,
) {
    const program = gl.createProgram()!;
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    const success = gl.getProgramParameter(program, gl.LINK_STATUS);
    if (!success) {
        const infoLog = gl.getProgramInfoLog(program);
        gl.deleteProgram(program);
        throw infoLog;
    }
    return program;
}

async function createFragProgram(fragmentShaderUrl: string) {
    const fragmentShader = await createShader(gl.FRAGMENT_SHADER, fragmentShaderUrl);
    return createProgram(vertexShader, fragmentShader);
}

function createTexture() {
    const texture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return texture;
}

let positionBuffer: WebGLBuffer;
let frameBuffer: WebGLFramebuffer;

let textureOriginal: WebGLTexture;
let textureStructureTensor: WebGLTexture;
let textureHBlurredStructureTensor: WebGLTexture;
let textureBlurredStructureTensor: WebGLTexture;
let textureAnisotropy: WebGLTexture;
let textureFiltered: WebGLTexture;

let vertexShader: WebGLShader;
let programCopy: WebGLProgram;
let programStructureTensor: WebGLProgram;
let programHBlurredStructureTensor: WebGLProgram;
let programBlurredStructureTensor: WebGLProgram;
let programAnisotropy: WebGLProgram;
let programShowAnisotropy: WebGLProgram;
let programKuwahara: WebGLProgram;

async function init() {
    const vertexPositions = [
        -1, -1,
        -1, +1,
        +1, +1,
        +1, -1,
    ];
    positionBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertexPositions), gl.STATIC_DRAW);

    frameBuffer = gl.createFramebuffer()!;

    textureOriginal = createTexture();
    textureStructureTensor = createTexture();
    textureHBlurredStructureTensor = createTexture();
    textureBlurredStructureTensor = createTexture();
    textureAnisotropy = createTexture();
    textureFiltered = createTexture();

    vertexShader = await createShader(gl.VERTEX_SHADER, "vertex");

    programCopy = await createFragProgram("copy");
    programStructureTensor = await createFragProgram("structureTensor");
    programHBlurredStructureTensor = await createFragProgram("hBlurredStructureTensor");
    programBlurredStructureTensor = await createFragProgram("blurredStructureTensor");
    programAnisotropy = await createFragProgram("anisotropy");
    programShowAnisotropy = await createFragProgram("showAnisotropy");
    programKuwahara = await createFragProgram("kuwahara");

    gl.clearColor(0, 0, 0, 0);

    img.addEventListener("load", loadImg);
    inputScale.addEventListener("input", loadImg);

    inputBlurRadius.addEventListener("input", recompute);
    inputKernelRadius.addEventListener("input", recompute);
    inputKernelSkew.addEventListener("input", recompute);
    inputSharpness.addEventListener("input", recompute);
    buttonSaveFiltered.addEventListener("click", saveFiltered);

    imagesContainer.addEventListener("scroll", render);
    window.addEventListener("scroll", render);
    window.addEventListener("resize", render);

    function onInputImage(): void {
        const files = inputImage.files!;
        if (files.length >= 1) {
            img.src = URL.createObjectURL(files[0]);
        }
    }
    inputImage.addEventListener("change", onInputImage);
    onInputImage()

    document.addEventListener("paste", (e) => {
        for (let item of e.clipboardData!.items) {
            if (item.kind === "file") {
                const reader = new FileReader();
                reader.addEventListener("load", (e) => {
                    img.src = e.target!.result as string;
                });
                reader.readAsDataURL(item.getAsFile()!);
                return;
            }
        }
    });
}


function resizeImage(image: HTMLElement, width: number, height: number) {
    image.style.width = `${width}px`;
    image.style.height = `${height}px`;
}

let width: number, height: number;

function loadImg() {
    const scale = +inputScale.value / 100;

    width = Math.ceil(img.width * scale);
    height = Math.ceil(img.height * scale);

    resizeImage(imageOriginal, width, height);
    resizeImage(imageStructureTensor, width, height);
    resizeImage(imageBlurredStructureTensor, width, height);
    resizeImage(imageAnisotropy, width, height);
    resizeImage(imageFiltered, width, height);

    gl.bindTexture(gl.TEXTURE_2D, textureOriginal);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.bindTexture(gl.TEXTURE_2D, textureStructureTensor);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, width, height, 0, gl.RGBA, gl.HALF_FLOAT, null);
    gl.bindTexture(gl.TEXTURE_2D, textureHBlurredStructureTensor);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, width, height, 0, gl.RGBA, gl.HALF_FLOAT, null);
    gl.bindTexture(gl.TEXTURE_2D, textureBlurredStructureTensor);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, width, height, 0, gl.RGBA, gl.HALF_FLOAT, null);
    gl.bindTexture(gl.TEXTURE_2D, textureAnisotropy);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, width, height, 0, gl.RGBA, gl.HALF_FLOAT, null);
    gl.bindTexture(gl.TEXTURE_2D, textureFiltered);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

    recompute();
}

function scissorImage(image: HTMLElement) {
    const containerRect = imagesContainer.getBoundingClientRect();
    const imageRect = image.getBoundingClientRect();

    const scissorTop = Math.max(containerRect.top, imageRect.top);
    const scissorLeft = Math.max(containerRect.left, imageRect.left);
    const scissorRight = Math.min(containerRect.right, imageRect.right);
    const scissorBottom = Math.min(containerRect.bottom, imageRect.bottom);

    const scissorX = scissorLeft;
    const scissorY = canvas.clientHeight - scissorBottom;
    const scissorWidth = scissorRight - scissorLeft
    const scissorHeight = scissorBottom - scissorTop;
    if (scissorWidth <= 0 || scissorHeight <= 0) {
        return false;
    }

    const viewportX = imageRect.left;
    const viewportY = canvas.clientHeight - imageRect.bottom;
    const viewportWidth = imageRect.right - imageRect.left;
    const viewportHeight = imageRect.bottom - imageRect.top;

    gl.viewport(viewportX, viewportY, viewportWidth, viewportHeight);
    gl.scissor(scissorX, scissorY, scissorWidth, scissorHeight);
    return true;
}

type Uniform
    = WebGLTexture
    | number
    | [number, number];

const attribLocCache: unique symbol = Symbol("attribLocCache");
const uniformLocCache: unique symbol = Symbol("uniformLocCache");

type WebGLProgramWithCache = WebGLProgram & Partial<{
    [attribLocCache]: Record<string, number>,
    [uniformLocCache]: Record<string, WebGLUniformLocation>,
}>;

function getAttribLocation(program: WebGLProgramWithCache, name: string) {
    if (program[attribLocCache] === undefined) {
        program[attribLocCache] = {};
    }
    const cache = program[attribLocCache];
    if (!(name in cache)) {
        cache[name] = gl.getAttribLocation(program, name);
    }
    return cache[name];
}

function getUniformLocation(program: WebGLProgramWithCache, name: string) {
    if (program[uniformLocCache] === undefined) {
        program[uniformLocCache] = {};
    }
    const cache = program[uniformLocCache];
    if (!(name in cache)) {
        cache[name] = gl.getUniformLocation(program, name)!;
    }
    return cache[name];
}

function runFragProgram(image: HTMLElement | WebGLTexture, program: WebGLProgram, uniforms: Record<string, Uniform>) {
    if (image instanceof WebGLTexture) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffer);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, image, 0);
        gl.disable(gl.SCISSOR_TEST);
        gl.viewport(0, 0, width, height);
    } else {
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.enable(gl.SCISSOR_TEST);
        if (!scissorImage(image)) return;
    }
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(program);
    const vertexPosLoc = getAttribLocation(program, "vertexPos")
    gl.enableVertexAttribArray(vertexPosLoc);
    gl.vertexAttribPointer(vertexPosLoc, 2, gl.FLOAT, false, 0, 0);

    let texI = 0;
    for (let name in uniforms) {
        const loc = getUniformLocation(program, name);
        const value = uniforms[name];
        if (value instanceof WebGLTexture) {
            gl.uniform1i(loc, texI);
            gl.activeTexture(gl.TEXTURE0+texI);
            gl.bindTexture(gl.TEXTURE_2D, value);
            texI++;
        } else if (typeof value === "number") {
            gl.uniform1f(loc, value);
        } else {
            gl.uniform2f(loc, value[0], value[1]);
        }
    }
    gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
}

function recompute() {
    if (img.src === "") return;

    const scale = +inputScale.value / 100;
    const width = Math.ceil(img.width * scale);
    const height = Math.ceil(img.height * scale);
    let blurRadius = +inputBlurRadius.value / 10;
    let kernelRadius = +inputKernelRadius.value / 10;
    const kernelSkew = +inputKernelSkew.value / 10;
    const sharpness = +inputSharpness.value / 10;

    inputScaleValue.innerHTML = scale.toFixed(2);
    inputBlurRadiusValue.innerHTML = blurRadius.toFixed(2);
    inputKernelRadiusValue.innerHTML = kernelRadius.toFixed(2);
    inputKernelSkewValue.innerHTML = kernelSkew.toFixed(2);
    inputSharpnessValue.innerHTML = sharpness.toFixed(2);

    blurRadius *= scale;
    kernelRadius *= scale;

    runFragProgram(textureStructureTensor, programStructureTensor, {
        flipY: 0.0,
        res: [width, height],
        original: textureOriginal,
    });
    runFragProgram(textureHBlurredStructureTensor, programHBlurredStructureTensor, {
        flipY: 0.0,
        res: [width, height],
        blurRadius,
        structureTensor: textureStructureTensor,
    });
    runFragProgram(textureBlurredStructureTensor, programBlurredStructureTensor, {
        flipY: 0.0,
        res: [width, height],
        blurRadius,
        hBlurredStructureTensor: textureHBlurredStructureTensor,
    });
    runFragProgram(textureAnisotropy, programAnisotropy, {
        flipY: 0.0,
        blurredStructureTensor: textureBlurredStructureTensor,
    });
    runFragProgram(textureFiltered, programKuwahara, {
        flipY: 0.0,
        res: [width, height],
        original: textureOriginal,
        anisotropy: textureAnisotropy,
        kernelRadius,
        kernelSkew,
        sharpness,
    });

    render();
}

async function saveFiltered() {
    if (img.src === "") return;

    gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, textureFiltered, 0);

    const filteredImg = new OffscreenCanvas(width, height);
    const ctx = filteredImg.getContext("2d")!;
    const imageData = ctx.createImageData(width, height);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, imageData.data);
    ctx.putImageData(imageData, 0, 0);
    const blob = await filteredImg.convertToBlob({type: "png"});
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    let downloadName = "filtered.png";
    const files = inputImage.files!;
    if (files.length > 0) {
        downloadName = files[0].name.replace(/\.[a-z0-9]+$/i, "") + " filtered.png";
    }
    link.download = downloadName;
    link.click();
}

function render() {
    if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
    }
    canvas.style.transform = `translateX(${window.scrollX}px) translateY(${window.scrollY}px)`;

    runFragProgram(imageOriginal, programCopy, {
        flipY: 1.0,
        tex: textureOriginal,
    });
    runFragProgram(imageStructureTensor, programCopy, {
        flipY: 1.0,
        tex: textureStructureTensor,
    });
    runFragProgram(imageBlurredStructureTensor, programCopy, {
        flipY: 1.0,
        tex: textureBlurredStructureTensor,
    });
    runFragProgram(imageAnisotropy, programShowAnisotropy, {
        flipY: 1.0,
        tex: textureAnisotropy,
    });
    runFragProgram(imageFiltered, programCopy, {
        flipY: 1.0,
        tex: textureFiltered,
    });

    gl.flush();
}

init();