---
layout: publication
title: "Mesh Simplification For Unfolding"
doi: ??

authors:
  - name: Bhargava, Manas
    affiliations: [1]
    url: https://manas-avi.github.io/
  - name: Schreck, Camille
    affiliations: [2]
    url: https://schreckc.github.io/
  - name: Friere, Marco
    affiliations: [2]
    url: https://mfremer.github.io/
  - name: Hugron, Pierre-Alexandre
    affiliations: [2]
  - name: Lefebvre, Sylvain
    affiliations: [2]
    url: https://www.antexel.com/sylefeb/
  - name: Sellán*, Silvia
    affiliations: [3,4]
    url: https://www.silviasellan.com/
  - name: Bickel*, Bernd
    affiliations: [1,5]
    url: http://berndbickel.com/

affiliations:
  - name: ISTA
    url: https://ista.ac.at
  - name: MFX
    url: https://mfx.loria.fr/
  - name: MIT
    url: https://people.csail.mit.edu/
  - name: ETH
    url: https://ethz.ch/en/the-eth-zurich.html

publication: Computer Graphics Forum 2024
date: 2024-10-29
grp: bickel
paper: Mesh_Simplification_For_Unfolding_cgf_camera_ready.pdf
supplemental: 
video: https://www.youtube.com/watch?v=EFJM6qPeksc
project: https://manas-avi.github.io/projects/MeshSimplificationForUnfolding/index.html
project_root: https://manas-avi.github.io/projects/MeshSimplificationForUnfolding/

bibtex: |
  @article{
  }



abstract: |
    We present a computational approach for unfolding 3D shapes isometrically into the plane as a single patch without overlapping
    triangles. This is a hard, sometimes impossible, problem, which existing methods are forced to soften by allowing for map
    distortions or multiple patches. Instead, we propose a geometric relaxation of the problem: we modify the input shape until it
    admits an overlap-free unfolding. We achieve this by locally displacing vertices and collapsing edges, guided by the unfolding
    process. We validate our algorithm quantitatively and qualitatively on a large dataset of complex shapes and show its proficiency
    by fabricating real shapes from paper.

teaser:
  caption: |
    
  images:
  - url: teaser.png
    alt: teaser
---

## {{ page.title }}

{% include figure.html caption=page.teaser.caption images=page.teaser.images columns=1 %}

{% include authors.html authors=page.authors affiliations=page.affiliations %}
(* Joint Last authors)
{% include publication.html publication=page.publication url=page.doi %}


### Abstract

{{ page.abstract }}

### Links

* [Paper]({{page.paper}})
* [Video]({{page.video}})
* [Code](https://git.ista.ac.at/mbhargav/mesh-simplification-for-unfolding)
<br>


### Citation

{% include citation.html citation=page.bibtex %}

### Acknowledgements

Researchers from INRIA received support from the DORNELL Inria Challenge. Silvia Sellán acknowledges support from NSERC Vanier Doctoral Scholarship and an MIT SoE Postdoctoral Fellowship for Engineering Excellence.