#version 100
precision mediump float;

varying vec2 pos;
uniform vec2 res;
uniform sampler2D original;
uniform sampler2D anisotropy;
uniform float kernelRadius;
uniform float kernelSkew;
uniform float sharpness;

void main() {
    vec2 t = texture2D(anisotropy, pos).xy;
    float coherency = t.x, orientation = t.y;

    float skew = (kernelSkew + coherency) / kernelSkew;
    float a = kernelRadius;
    float b = kernelRadius / skew;
    float cos_phi = cos(orientation);
    float sin_phi = sin(orientation);
    mat2 R = mat2(
        cos_phi, -sin_phi,
        sin_phi, cos_phi
    );
    mat2 S = mat2(
        0.5 / a, 0,
        0, 0.5 / b
    );
    mat2 SR = S * R;

    int max_x = int(sqrt(a * a * cos_phi * cos_phi + b * b * sin_phi * sin_phi));
    int max_y = int(sqrt(a * a * sin_phi * sin_phi + b * b * cos_phi * cos_phi));

    float zeta = 2.0 / kernelRadius;
    float zeroCross = 0.58;
    float sinZeroCross = sin(zeroCross);
    float eta = (zeta + cos(zeroCross)) / (sinZeroCross * sinZeroCross);
    vec4 m[8];
    vec3 s[8];
    for (int k = 0; k < 8; ++k) {
        m[k] = vec4(0,0,0,0);
        s[k] = vec3(0,0,0);
    }

    int range = int(2.5 * kernelRadius);
    float dx = 1.0/res.x, dy = 1.0/res.y;
    for (int i = 0; i <= 300; ++i) {
        int x = i - range;
        if (x > range) break;
        for (int j = 0; j <= 300; ++j) {
            int y = j - range;
            if (j > range) break;
            vec2 v = SR * vec2(x,y);
            if (dot(v,v) <= 0.25) {
                vec3 c = texture2D(original, pos+vec2(dx*float(x),dy*float(y))).rgb;
                float sum = 0.0;
                float w[8];
                float z, vxx, vyy;

                /* Calculate Polynomial Weights */
                vxx = zeta - eta * v.x * v.x;
                vyy = zeta - eta * v.y * v.y;
                z = max(0.0, v.y + vxx);
                w[0] = z * z;
                sum += w[0];
                z = max(0.0, -v.x + vyy);
                w[2] = z * z;
                sum += w[2];
                z = max(0.0, -v.y + vxx);
                w[4] = z * z;
                sum += w[4];
                z = max(0.0, v.x + vyy);
                w[6] = z * z;
                sum += w[6];
                v = sqrt(2.0) / 2.0 * vec2(v.x - v.y, v.x + v.y);
                vxx = zeta - eta * v.x * v.x;
                vyy = zeta - eta * v.y * v.y;
                z = max(0.0, v.y + vxx);
                w[1] = z * z;
                sum += w[1];
                z = max(0.0, -v.x + vyy);
                w[3] = z * z;
                sum += w[3];
                z = max(0.0, -v.y + vxx);
                w[5] = z * z;
                sum += w[5];
                z = max(0.0, v.x + vyy);
                w[7] = z * z;
                sum += w[7];

                float g = exp(-3.125 * dot(v,v)) / sum;

                for (int k = 0; k < 8; ++k) {
                    float wk = w[k] * g;
                    m[k] += vec4(c * wk, wk);
                    s[k] += c * c * wk;
                }
            }
        }
    }

    gl_FragColor = vec4(0,0,0,0);
    for (int k = 0; k < 8; ++k) {
        m[k].rgb /= m[k].w;
        s[k] = abs(s[k] / m[k].w - m[k].rgb * m[k].rgb);

        float sigma2 = s[k].r + s[k].g + s[k].b;
        float w = 1.0 / (1.0 + pow(abs(1000.0 * sigma2), 0.5 * sharpness));

        gl_FragColor += vec4(m[k].rgb * w, w);
    }

    gl_FragColor /= gl_FragColor.w;
}