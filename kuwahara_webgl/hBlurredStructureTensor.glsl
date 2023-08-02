#version 100
precision mediump float;

const float PI = 3.14159265359;

varying vec2 pos;
uniform vec2 res;
uniform sampler2D structureTensor;
uniform float blurRadius;

float gaussian(float pos) {
    return (1.0 / sqrt(2.0 * PI * blurRadius * blurRadius)) * exp(-(pos * pos) / (2.0 * blurRadius * blurRadius));
}

void main() {
    gl_FragColor = vec4(0,0,0,0);
    float dx = 1.0/res.x;
    int kernelRadius = int(2.5 * blurRadius);
    for (int i = 0; i <= 300; i++) {
        int x = i - kernelRadius;
        if (x > kernelRadius) break;
        vec3 c = texture2D(structureTensor, pos+vec2(dx*float(x),0)).xyz;
        float w = gaussian(float(x));
        gl_FragColor += vec4(w*c,w);
    }
    gl_FragColor /= gl_FragColor.w;
}