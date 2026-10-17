/* The scene supplies formula tokens and emphasis; the renderer owns only DOM. */
(function (root) {
  'use strict';
  const Story = root.SIMGetPeak;
  function build({ group, compile, progress }) {
    const s = Story.presentation(progress), parts = {};
    group.setAttribute('class', 'pe-study-formula pe-two-formula pe-peak-formula');
    for (const part of s.formula.parts) parts[part.key] = compile(group, 'get-peak-' + part.key, part.tex);
    return parts;
  }
  function draw(group, parts, progress) {
    const s = Story.presentation(progress);
    group.style.opacity = String(s.formula.opacity);
    group.setAttribute('data-get-peak-formula-beat', s.formula.mode);
    for (const [name, node] of Object.entries(parts)) node.setAttribute('data-emphasized', s.formula.emphasis.includes(name));
  }
  Story.formulaView = { build, draw };
})(typeof globalThis !== 'undefined' ? globalThis : this);
