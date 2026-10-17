import java.util.Locale;
import java.util.Random;
import org.fairsim.linalg.*;
import org.fairsim.sim_algorithm.*;
import org.fairsim.utils.Tool;

/** A synthetic, headless experiment using the unmodified fairSIM estimator.
 * Uses a periodic, noise-free sample and integer illumination frequencies.
 * This checks the API and conventions, not accuracy on experimental images. */
public class ParameterEstimationDemo {
    static final int N = 64, DIRS = 3, PHASES = 3;
    static final double CUTOFF_BINS = 20;
    // Ground truth uses array coordinates: x right, y down.
    static final double[][] K = {{12, 5}, {-4, 13}, {9, -10}};
    static final double[] OFFSET = {.7, -.4, 1.1};
    static final double MODULATION = .8;

    static double[] sample() {
        double[] out = new double[N * N];
        Random random = new Random(20261013L);
        for (int bead = 0; bead < 70; bead++) {
            double bx = N * random.nextDouble(), by = N * random.nextDouble();
            double width = .6 + .8 * random.nextDouble();
            double height = .5 + random.nextDouble();
            for (int y = 0; y < N; y++) for (int x = 0; x < N; x++) {
                double dx = Math.abs(x - bx), dy = Math.abs(y - by);
                dx = Math.min(dx, N - dx); dy = Math.min(dy, N - dy);
                out[y * N + x] += height * Math.exp(-(dx * dx + dy * dy) / (2 * width * width));
            }
        }
        return out;
    }

    static Vec2d.Cplx[][] capture(double[] object, OtfProvider otf) {
        Vec2d.Cplx[][] fft = new Vec2d.Cplx[DIRS][PHASES];
        for (int d = 0; d < DIRS; d++) for (int j = 0; j < PHASES; j++) {
            Vec2d.Cplx frame = Vec2d.createCplx(N, N);
            float[] pixels = frame.vectorData();
            double phase = 2 * Math.PI * j / PHASES + OFFSET[d];
            for (int y = 0; y < N; y++) for (int x = 0; x < N; x++) {
                double argument = 2 * Math.PI * (K[d][0] * x + K[d][1] * y) / N + phase;
                pixels[2 * (y * N + x)] = (float) (object[y * N + x] * (1 + MODULATION * Math.cos(argument)));
            }
            frame.syncBuffer();
            frame.fft2d(false);
            otf.applyOtf(frame, 0); // Fourier transform of PSF-convolved camera frame.
            fft[d][j] = frame;
        }
        return fft;
    }

    static double phaseError(double estimated, double truth) {
        return Math.atan2(Math.sin(estimated - truth), Math.cos(estimated - truth));
    }

    public static void main(String[] args) {
        Locale.setDefault(Locale.ROOT);
        try {
            // This artificial OTF has a cutoff of 1 cycle/micron, or 20 FFT bins.
            OtfProvider otf = OtfProvider.fromEstimate(1, 2000, 1);
            otf.switchAttenuation(false);
            double pixelSizeMicron = CUTOFF_BINS / N;
            otf.setPixelSize(1 / (N * pixelSizeMicron));
            Vec2d.Cplx[][] inFFT = capture(sample(), otf);

            // No true wave vector, phase offset or modulation is supplied here.
            SimParam param = SimParam.create(2, DIRS, PHASES, N, pixelSizeMicron, otf);
            SimAlgorithm.estimateParameters(param, inFFT, 1, .3, null, 0, null);

            double maxKError = 0, maxPhaseError = 0, maxModError = 0;
            for (int d = 0; d < DIRS; d++) {
                SimParam.Dir dir = param.dir(d);
                // fairSIM uses y up; the generator above uses y down.
                double expectedX = K[d][0], expectedY = -K[d][1];
                double kError = Math.hypot(dir.px(1) - expectedX, dir.py(1) - expectedY);
                double pError = Math.abs(phaseError(dir.getPhaOff(), OFFSET[d]));
                double m = dir.getRawModulations()[1];
                maxKError = Math.max(maxKError, kError);
                maxPhaseError = Math.max(maxPhaseError, pError);
                maxModError = Math.max(maxModError, Math.abs(m - MODULATION));
                System.out.printf("RESULT dir=%d trueK=(%.3f,%.3f) estimatedK=(%.6f,%.6f) truePhase=%.3f estimatedPhase=%.6f trueM=%.3f estimatedM=%.6f adoptedM=%.6f%n",
                    d, expectedX, expectedY, dir.px(1), dir.py(1), OFFSET[d], dir.getPhaOff(), MODULATION, m, dir.getModulations()[1]);
            }
            // fitPeak's final 10-point grid spans +/-0.1 bins, without a center
            // point. Its spacing is 0.2/9 bins; finite shifts affect both phase
            // and modulation. These bounds are for this fixed teaching case.
            if (maxKError > .025 || maxPhaseError > .10 || maxModError > .03)
                throw new AssertionError("Unexpected estimation error");
            System.out.printf("CHECK maxKError=%.6f bins maxPhaseError=%.6f rad maxModulationError=%.6f%n", maxKError, maxPhaseError, maxModError);
        } finally {
            Tool.shutdown();
        }
    }
}
