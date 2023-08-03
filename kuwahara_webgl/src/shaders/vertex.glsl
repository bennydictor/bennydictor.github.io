#version 100

attribute vec4 vertexPos;
varying vec2 pos;
uniform float flipY;

void main() {
    gl_Position = vertexPos;
    pos = (vertexPos.xy + vec2(1,1)) / 2.0;
    if (flipY > 0.5) {
        pos.y = 1.0 - pos.y;
    }
}