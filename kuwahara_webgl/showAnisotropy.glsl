#version 100
precision mediump float;

varying vec2 pos;
uniform sampler2D anisotropy;

vec3 fromHue(float hue) {
    hue = degrees(hue);
    if (hue < 0.0) hue += 360.0;

    float x = 1.0 - abs(mod(hue / 60.0, 2.0) - 1.0);

    if (hue < 60.0) return vec3(1,x,0);
    if (hue < 120.0) return vec3(x,1,0);
    if (hue < 180.0) return vec3(0,1,x);
    if (hue < 240.0) return vec3(0,x,1);
    if (hue < 300.0) return vec3(x,0,1);
    return vec3(1,0,x);
}

void main() {
    vec2 a = texture2D(anisotropy, pos).xy;
    float coherency = a.x, orientation = a.y;
    gl_FragColor = vec4(coherency * fromHue(orientation * 2.0),1);
}