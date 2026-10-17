import java.io.*;
import org.fairsim.linalg.*;
import org.fairsim.sim_algorithm.*;
import org.fairsim.utils.Tool;

/** Calls the unmodified local commonRegion/getPeak on supplied complex bands.
 * The binary fixtures and comparisons live in sim-fairsim-get-peak.test.cjs. */
public class PeakReference {
    public static void main(String[] args) throws Exception {
        try (DataInputStream in = new DataInputStream(new BufferedInputStream(new FileInputStream(args[0])))) {
            int n = in.readInt();
            double cutoff = in.readDouble(), kx = in.readDouble(), ky = in.readDouble();
            OtfProvider otf = OtfProvider.fromEstimate(1, 2000, 1);
            otf.switchAttenuation(false);
            otf.setPixelSize(1 / cutoff);
            Vec2d.Cplx[] bands = Vec2d.createArrayCplx(2, n, n);
            for (Vec2d.Cplx band : bands) {
                float[] data = band.vectorData();
                for (int i = 0; i < n * n * 2; i++) data[i] = in.readFloat();
                band.syncBuffer();
            }
            // Local page coordinates have y down and the positive band uses
            // S(f-k). fairSIM's getPeak arguments use the opposite x shift.
            Cplx.Double alpha = Correlation.getPeak(bands[0], bands[1], 0, 1, otf, -kx, ky, .05);
            Correlation.commonRegion(bands[0], bands[1], 0, 1, otf, -kx, ky, .15, .05, true);
            try (DataOutputStream out = new DataOutputStream(new BufferedOutputStream(new FileOutputStream(args[1])))) {
                out.writeDouble(alpha.re); out.writeDouble(alpha.im);
                for (Vec2d.Cplx band : bands) for (float value : band.vectorData()) out.writeFloat(value);
            }
        } finally { Tool.shutdown(); }
    }
}
