import java.io.*;
import org.fairsim.linalg.*;
import org.fairsim.sim_algorithm.*;
import org.fairsim.utils.Tool;

/** Executes the real, unmodified fairSIM reconstruction on supplied frames.
 * Input/output are big-endian binary. See sim-atlas-fairsim.test.cjs. */
public class Reference {
    public static void main(String[] args) throws Exception {
        try (DataInputStream in = new DataInputStream(new BufferedInputStream(new FileInputStream(args[0])))) {
            int n = in.readInt(), dirs = in.readInt();
            double kc = in.readDouble(), w = in.readDouble(), bend = in.readDouble(), cut = in.readDouble();
            OtfProvider otf = OtfProvider.fromEstimate(1, 2000, 1);
            otf.switchAttenuation(false);
            SimParam param = SimParam.create(2, dirs, 3, n, kc / n, otf);
            param.setWienerFilter(w); param.setApoBend(bend); param.setApoCutoff(cut);
            Vec2d.Cplx[][] frames = new Vec2d.Cplx[dirs][3];
            for (int d = 0; d < dirs; d++) {
                double kx = in.readDouble(), ky = in.readDouble(), m = in.readDouble();
                param.dir(d).setPxPy(kx, -ky); // fairSIM y points up, atlas rows point down.
                param.dir(d).setModulation(1, m);
                double[] phases = new double[3];
                for (int j = 0; j < 3; j++) phases[j] = in.readDouble();
                param.dir(d).setPhases(phases, true);
                for (int j = 0; j < 3; j++) {
                    frames[d][j] = Vec2d.createCplx(n, n);
                    float[] data = frames[d][j].vectorData();
                    for (int i = 0; i < n * n; i++) data[2 * i] = in.readFloat();
                    frames[d][j].syncBuffer(); frames[d][j].fft2d(false);
                }
            }
            Vec2d.Real result = SimAlgorithm.runReconstruction(param, frames, null, -1, false, SimParam.CLIPSCALE.NONE, null);
            try (DataOutputStream out = new DataOutputStream(new BufferedOutputStream(new FileOutputStream(args[1])))) {
                for (float v : result.vectorData()) out.writeFloat(v);
            }
        } finally { Tool.shutdown(); }
    }
}
