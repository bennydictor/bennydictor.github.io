#version 100
precision mediump float;

varying vec2 pos;
uniform sampler2D blurredStructureTensor;

void main() {
    vec3 bt = texture2D(blurredStructureTensor, pos).xyz;
    float tmp = sqrt((bt.x - bt.y) * (bt.x - bt.y) + 4.0 * bt.z * bt.z);
    float l1 = 0.5 * (bt.x + bt.y + tmp);
    float l2 = 0.5 * (bt.x + bt.y - tmp);

    float coherency = (l1+l2 > 0.0) ? (l1-l2)/(l1+l2) : 1.0;
    float orientation = bt.y - bt.x != 0.0 ? 0.5 * atan(2.0 * bt.z, bt.y - bt.x) : 0.0;

    gl_FragColor = vec4(coherency, orientation, 0, 1);
}