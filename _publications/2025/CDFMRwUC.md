---
layout: publication
title: "Computational Design and Fabrication of Modular Robots with Untethered Control"
doi: arXiv:2508.05410


authors:
  - name: Bhargava, Manas
    affiliations: [1]
    url: https://manas-avi.github.io/
  - name: Hiraki, Takefumi 
    affiliations: [2,3]
    url: 
  - name: Strugaru, Malina 
    affiliations: [1]
    url: 
  - name: Piovarci, Michal
    affiliations: [1,4]
  - name: Daraio, Chiara 
    affiliations: [5]
    url: https://www.eas.caltech.edu/people/daraio
  - name: Iwai, Daisuke 
    affiliations: [6]
    url: https://daisukeiwai.org/
  - name: Bickel, Bernd
    affiliations: [1,4]
    url: http://berndbickel.com/

affiliations:
  - name: ISTA
    url: https://ista.ac.at
  - name: UofTs
    url: https://www.tsukuba.ac.jp/en/
  - name: CMV
    url: https://lab.cluster.mu/en/
  - name: ETH
    url: https://ethz.ch/en/the-eth-zurich.html
  - name: CAL
    url: https://www.caltech.edu/
  - name: UofOs
    url: The University of Osaka

publication: Arxiv (under submission)
date: 2025-08-31
grp: bickel
paper: ComputationalDesignandFabricationofModularRobotswithUntetheredControl_arxiv.pdf
supplemental: 
video: 
fast-forward: 
project: https://manas-avi.github.io/projects/CDFMRwUC/index.html
project_root: https://manas-avi.github.io/projects/CDFMRwUC/

bibtex: |
  @misc{bhargava2025computationaldesignfabricationmodular,
      title={Computational Design and Fabrication of Modular Robots with Untethered Control}, 
      author={Manas Bhargava and Takefumi Hiraki and Malina Strugaru and Yuhan Zhang and Michal Piovarci and Chiara Daraio and Daisuke Iwai and Bernd Bickel},
      year={2025},
      eprint={2508.05410},
      archivePrefix={arXiv},
      primaryClass={cs.RO},
      url={https://arxiv.org/abs/2508.05410},}

abstract: |
    Natural organisms utilize distributed actuation through their musculoskeletal systems to adapt their gait for traversing diverse terrains or to morph their bodies for varied tasks. A longstanding challenge in robotics is to emulate this capability of natural organisms, which has motivated the development of numerous soft robotic systems. However, such systems are generally optimized for a single functionality, lack the ability to change form or function on demand, or remain tethered to bulky control systems. To address these limitations, we present a framework for designing and controlling robots that utilize distributed actuation. We propose a novel building block that integrates 3D-printed bones with liquid crystal elastomer (LCE) muscles as lightweight actuators, enabling the modular assembly of musculoskeletal robots. We developed LCE rods that contract in response to infrared radiation, thereby providing localized, untethered control over the distributed skeletal network and producing global deformations of the robot. To fully capitalize on the extensive design space, we introduce two computational tools: one for optimizing the robot's skeletal graph to achieve multiple target deformations, and another for co-optimizing skeletal designs and control gaits to realize desired locomotion. We validate our framework by constructing several robots that demonstrate complex shape morphing, diverse control schemes, and environmental adaptability. Our system integrates advances in modular material building, untethered and distributed control, and computational design to introduce a new generation of robots that brings us closer to the capabilities of living organisms.


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
* [Fast-forward]({{page.fast-forward}})
<br>


### Citation

{% include citation.html citation=page.bibtex %}

### Acknowledgements

The authors express gratitude to Magali Lorion for assisting in the initial fabrication of LCEs, Pengbin Tang for providing the code for simulating discrete elastic rods, the Imaging and Optics Facility at ISTA for assisting with the spectrometry measurements, and the MIBA machine shop at ISTA for their support in manufacturing various devices.Funding: This project was supported by the European Research Council (ERC) under the European Union’s Horizon 2020 research and innovation program (Grant Agreement No. 715767 -– MATERIALIZABLE).