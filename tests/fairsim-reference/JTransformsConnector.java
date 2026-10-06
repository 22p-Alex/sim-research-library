package org.fairsim.linalg;

/** Test-only FFT adapter, no reconstruction logic. Lets the unmodified fairSIM
 * Java sources run without downloading ImageJ/JTransforms. Radix-2 complex FFT. */
public class JTransformsConnector extends FftProvider {
    public JTransformsConnector() { setFftFactory(this); }
    public String getImplementationName() { return "test radix-2 FFT"; }
    private static void fft(double[] re, double[] im, boolean inverse) {
        int n = re.length;
        for (int i = 1, j = 0; i < n; i++) {
            int bit = n >> 1;
            for (; (j & bit) != 0; bit >>= 1) j ^= bit;
            j ^= bit;
            if (i < j) { double t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
        }
        for (int len = 2; len <= n; len <<= 1) {
            double angle = (inverse ? 2 : -2) * Math.PI / len;
            for (int start = 0; start < n; start += len) for (int j = 0; j < len / 2; j++) {
                double c = Math.cos(angle * j), s = Math.sin(angle * j);
                int a = start + j, b = a + len / 2;
                double tr = c * re[b] - s * im[b], ti = s * re[b] + c * im[b];
                re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
            }
        }
        if (inverse) for (int i = 0; i < n; i++) { re[i] /= n; im[i] /= n; }
    }
    public Instance create1Dfft(int n) { return create2Dfft(n, 1); }
    public Instance create2Dfft(int width, int height) {
        return (data, inverse) -> {
            double[] re = new double[width], im = new double[width];
            for (int y = 0; y < height; y++) {
                for (int x = 0; x < width; x++) { int i = 2 * (y * width + x); re[x] = data[i]; im[x] = data[i + 1]; }
                fft(re, im, inverse);
                for (int x = 0; x < width; x++) { int i = 2 * (y * width + x); data[i] = (float) re[x]; data[i + 1] = (float) im[x]; }
            }
            re = new double[height]; im = new double[height];
            for (int x = 0; x < width; x++) {
                for (int y = 0; y < height; y++) { int i = 2 * (y * width + x); re[y] = data[i]; im[y] = data[i + 1]; }
                fft(re, im, inverse);
                for (int y = 0; y < height; y++) { int i = 2 * (y * width + x); data[i] = (float) re[y]; data[i + 1] = (float) im[y]; }
            }
        };
    }
    public Instance create3Dfft(int x, int y, int z) { throw new UnsupportedOperationException("2D reference only"); }
}
