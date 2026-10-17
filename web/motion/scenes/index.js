/* The order of scene units; no scene content belongs in this file. */
(function(root) {
  const node=typeof module!=='undefined'&&module.exports;
  const scenes=node?[
    require('./sample/storyboard.js'),
    require('./widefield/storyboard.js'),
    require('./illumination/storyboard.js'),
    require('./frequency-encoding/storyboard.js'),
    require('./encoding-sum/storyboard.js'),
    require('./detection/storyboard.js'),
    require('./phase-acquisition/storyboard.js'),
    require('./frequency-probe/storyboard.js'),
    require('./mixed-sources/storyboard.js'),
    require('./inverse-demix/storyboard.js'),
    require('./verify-demix/storyboard.js'),
    require('./separate-bands/storyboard.js'),
    require('./relocate-bands/storyboard.js'),
    require('./recover-high-frequency/storyboard.js'),
    require('./directions/storyboard.js'),
    require('./single-direction-support/storyboard.js'),
    require('./combined-support/storyboard.js'),
    require('./otf-weight/storyboard.js'),
    require('./sum-contributions/storyboard.js'),
    require('./wiener/storyboard.js'),
    require('./apodization/storyboard.js'),
    require('./inverse-fft/storyboard.js'),
    require('./image-comparison/storyboard.js'),
    require('./frequency-audit/storyboard.js')
  ]:["sample","widefield","illumination","frequency-encoding","encoding-sum","detection","phase-acquisition","frequency-probe","mixed-sources","inverse-demix","verify-demix","separate-bands","relocate-bands","recover-high-frequency","directions","single-direction-support","combined-support","otf-weight","sum-contributions","wiener","apodization","inverse-fft","image-comparison","frequency-audit"].map(id=>root.SIMMotionUnits[id]);
  if(node)module.exports=scenes;else root.SIMMotionSceneList=scenes;
})(typeof globalThis!=='undefined'?globalThis:this);
