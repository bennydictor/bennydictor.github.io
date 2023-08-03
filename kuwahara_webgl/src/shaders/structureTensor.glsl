#version 100
precision mediump float;

varying vec2 pos;
uniform vec2 res;
uniform sampler2D original;


vec3 at(vec2 pos) {
    return texture2D(original, pos).rgb;
}

void main() {
    float dx = 1.0/res.x;
    float dy = 1.0/res.y;

    vec3 sobelX = (
        - 1.0 * at(pos+vec2(-dx,-dy))
        - 2.0 * at(pos+vec2(-dx,  0))
        - 1.0 * at(pos+vec2(-dx,+dy))
        + 1.0 * at(pos+vec2(+dx,-dy))
        + 2.0 * at(pos+vec2(+dx,  0))
        + 1.0 * at(pos+vec2(+dx,+dy))
    ) / 4.0;

    vec3 sobelY = (
    - 1.0 * at(pos+vec2(-dx,-dy))
    - 2.0 * at(pos+vec2(  0,-dy))
    - 1.0 * at(pos+vec2(+dx,-dy))
    + 1.0 * at(pos+vec2(-dx,+dy))
    + 2.0 * at(pos+vec2(  0,+dy))
    + 1.0 * at(pos+vec2(+dx,+dy))
    ) / 4.0;

    gl_FragColor = vec4(
        dot(sobelX, sobelX),
        dot(sobelY, sobelY),
        dot(sobelX, sobelY),
        1
    );
}