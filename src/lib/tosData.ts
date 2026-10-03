/**
 * tosData.ts
 * ──────────────────────────────────────────────────────────────────────────────
 * Static specification for the Philippine ECE Licensure Exam (PECE)
 * Table of Specifications (TOS).
 *
 * 3-level hierarchy: Subject → Topic (x.0) → SubTopic (x.x)
 * Mirrors src/components/toc/data.ts exactly.
 *
 * Exam schedule:
 *   Day 1 AM: MATH  (20%)
 *   Day 1 PM: ELECS (30%)
 *   Day 2 AM: GEAS  (20%)
 *   Day 2 PM: EST   (30%)
 */

export interface TOSSubTopic {
  /** e.g. "1.1 Functions, Continuity, Limits" */
  name: string
}

export interface TOSTopic {
  /** Unique key within the subject, e.g. "MATH-1.0" */
  id: string
  /** e.g. "1.0 Differential Calculus" */
  name: string
  subtopics: TOSSubTopic[]
}

export interface TOSSubject {
  code: 'MATH' | 'ELECS' | 'GEAS' | 'EST'
  label: string
  weight: number
  topics: TOSTopic[]
}

export const TOS_DATA: TOSSubject[] = [
  // ─── DAY 1 · AM ──────────────────────────────────────────────────────────────
  {
    code: 'MATH',
    label: 'Mathematics',
    weight: 20,
    topics: [
      {
        id: 'MATH-1.0',
        name: '1.0 Differential Calculus',
        subtopics: [
          { name: '1.1 Functions, Continuity, Limits' },
          { name: '1.2 Derivatives and Its Applications' },
          { name: '1.3 Higher-Order Derivatives' },
          { name: '1.4 Parametric Equations' },
          { name: '1.5 Partial Differentiation' },
        ],
      },
      {
        id: 'MATH-2.0',
        name: '2.0 Integral Calculus',
        subtopics: [
          { name: '2.1 Integration Concepts/Formulas' },
          { name: '2.2 Integration Techniques' },
          { name: '2.3 Improper Integrals' },
          { name: '2.4 Application of Integral' },
          { name: '2.5 Multiple Integration and its Application' },
        ],
      },
      {
        id: 'MATH-3.0',
        name: '3.0 Differential Equation',
        subtopics: [
          { name: '3.1 First-Order, First-Degree ODE and its Application' },
          { name: '3.2 Higher-Order ODE and its Application' },
          { name: '3.3 Laplace Transforms, Inverses, and its Applications' },
        ],
      },
      {
        id: 'MATH-4.0',
        name: '4.0 Advanced Engineering Mathematics for ECE',
        subtopics: [
          { name: '4.1 Complex Numbers and its Applications' },
          { name: '4.2 Series and Transforms (Power Series, Bessel, Legendre, Fourier Series; Fourier Transforms)' },
          { name: '4.3 Partial Differential Equations' },
          { name: '4.4 Simultaneous Linear and Non-Linear Equations' },
          { name: '4.5 Numerical Differentiation, Integration and Optimization' },
        ],
      },
      {
        id: 'MATH-5.0',
        name: '5.0 Engineering Data Analysis',
        subtopics: [
          { name: '5.1 Obtaining Data' },
          { name: '5.2 Statistical Sampling, Distribution, and Intervals' },
          { name: '5.3 Test of Hypothesis' },
          { name: '5.4 Regression and Correlation' },
          { name: '5.5 Design of Experiments' },
        ],
      },
      {
        id: 'MATH-6.0',
        name: '6.0 Electromagnetics',
        subtopics: [
          { name: '6.1 Vector Analysis' },
          { name: '6.2 Directional Derivative, Gradient, Divergence, Curl' },
          { name: "6.3 Integral Theorems (Green's, Divergence, Stokes')" },
        ],
      },
      {
        id: 'MATH-7.0',
        name: '7.0 Signals, Spectra & Signal Processing',
        subtopics: [
          { name: '7.1 Z-Transforms' },
          { name: '7.2 Convolution' },
          { name: '7.3 Correlation' },
        ],
      },
      {
        id: 'MATH-8.0',
        name: '8.0 Feedback and Control Systems',
        subtopics: [
          { name: '8.1 Pole and Zero Determination' },
          { name: '8.2 Transient Response' },
          { name: '8.3 Block Diagram and Signal Flow' },
        ],
      },
    ],
  },

  // ─── DAY 1 · PM ──────────────────────────────────────────────────────────────
  {
    code: 'ELECS',
    label: 'Electronics Engineering',
    weight: 30,
    topics: [
      {
        id: 'ELECS-1.0',
        name: '1.0 DC Electrical Circuits',
        subtopics: [
          { name: '1.1 Resistive Network' },
          { name: '1.2 Mesh and Node Equations' },
          { name: '1.3 Network Theorems' },
          { name: '1.4 Transient Analysis' },
          { name: '1.5 Solution to DC Network Problems' },
        ],
      },
      {
        id: 'ELECS-2.0',
        name: '2.0 AC Electrical Circuits',
        subtopics: [
          { name: '2.1 Solution to AC Network Problems' },
          { name: '2.2 Impedance and Admittance' },
          { name: '2.3 Resonance' },
          { name: '2.4 Power in AC Circuits' },
          { name: '2.5 Two-Port Network Parameters and Transfer Function' },
        ],
      },
      {
        id: 'ELECS-3.0',
        name: '3.0 Electromagnetics',
        subtopics: [
          { name: '3.1 Steady Electric and Magnetic Fields' },
          { name: '3.2 Dielectric and Magnetic Materials' },
          { name: '3.3 Coupled and Magnetic Circuits' },
          { name: "3.4 Time-Varying Fields and Maxwell's Equations" },
        ],
      },
      {
        id: 'ELECS-4.0',
        name: '4.0 Electronic Devices and Circuits',
        subtopics: [
          { name: '4.1 Diode Wave Shaping and Special Diode Applications' },
          { name: '4.2 BJT and FET Small Signal Analysis' },
          { name: '4.3 Diode Equivalent Circuits' },
          { name: '4.4 Voltage Multipliers, Power Supply, Voltage Regulation' },
          { name: '4.5 Bipolar Junction Transistor and FET' },
        ],
      },
      {
        id: 'ELECS-5.0',
        name: '5.0 Electronic Circuit Analysis and Design',
        subtopics: [
          { name: '5.1 BJT and FET Frequency Response' },
          { name: '5.2 Cascade and Cascode Connections' },
          { name: '5.3 Current Mirrors and Current Sources' },
          { name: '5.4 Differential and Operational Amplifiers' },
          { name: '5.5 Feedback Systems, Oscillators, and Filters' },
        ],
      },
      {
        id: 'ELECS-6.0',
        name: '6.0 Electronic Systems and Design',
        subtopics: [
          { name: '6.1 SCRs, UJT, PUT, TRIAC, DIAC, and Thyristors' },
          { name: '6.2 Optoelectronic Devices and Sensors' },
          { name: '6.3 Transducers, Data Acquisition, and Interfacing' },
          { name: '6.4 Programmable Logic Controllers' },
          { name: '6.5 Building Management Systems and HVAC Controls' },
          { name: '6.6 Security, Safety, and Surveillance Systems' },
        ],
      },
      {
        id: 'ELECS-7.0',
        name: '7.0 Logic Circuits and Switching Theory',
        subtopics: [
          { name: '7.1 Boolean Algebra and Logic Gates' },
          { name: '7.2 Minimization of Combinational Logic Circuits' },
          { name: '7.3 Sequential Logic Circuits' },
          { name: '7.4 Algorithmic State Machine (ASM)' },
          { name: '7.5 Asynchronous Sequential Logic' },
        ],
      },
      {
        id: 'ELECS-8.0',
        name: '8.0 Microprocessor and Microcontroller Systems',
        subtopics: [
          { name: '8.1 Microprocessor Unit' },
          { name: '8.2 Memory Subsystem' },
          { name: '8.3 I/O Subsystem' },
          { name: '8.4 Instruction Set Architecture and Assembly Programming' },
          { name: '8.5 Microcontrollers' },
        ],
      },
      {
        id: 'ELECS-9.0',
        name: '9.0 Feedback and Control Systems',
        subtopics: [
          { name: '9.1 Block Diagram and Signal Flow Graphs' },
          { name: '9.2 LTI Systems and Transient Analysis' },
          { name: '9.3 System Modeling and Transfer Function' },
          { name: '9.4 Poles, Zeros, Root Locus, and Stability Analysis' },
          { name: '9.5 Steady State Analysis and Frequency Response' },
        ],
      },
    ],
  },

  // ─── DAY 2 · AM ──────────────────────────────────────────────────────────────
  {
    code: 'GEAS',
    label: 'General Engineering & Applied Sciences',
    weight: 20,
    topics: [
      {
        id: 'GEAS-1.0',
        name: '1.0 Chemistry for Engineers',
        subtopics: [
          { name: '1.1 Energy' },
          { name: '1.2 Chemistry of Engineering Materials' },
          { name: '1.3 Chemistry of Nanomaterials' },
          { name: '1.4 Chemistry of the Environment' },
        ],
      },
      {
        id: 'GEAS-2.0',
        name: '2.0 Physics for Engineers',
        subtopics: [
          { name: '2.1 Work, Energy and Power' },
          { name: '2.2 Impulse and Momentum' },
          { name: '2.3 Kinematics' },
          { name: '2.4 Dynamics' },
          { name: '2.5 Rotation and Dynamic of Rotation' },
          { name: '2.6 Elasticity' },
          { name: '2.7 Oscillations and Waves' },
          { name: '2.8 Fluids' },
          { name: '2.9 Heat Transfer' },
          { name: '2.10 Electrostatics, Electricity, Magnetism, Optics' },
        ],
      },
      {
        id: 'GEAS-3.0',
        name: '3.0 Engineering Economics',
        subtopics: [
          { name: '3.1 Engineering Economics Terms' },
          { name: '3.2 Money-Time Relationship and Equivalence' },
          { name: '3.3 Basic Economy Study Methods' },
          { name: '3.4 Decisions Under Certainty' },
          { name: '3.5 Decisions Recognizing Risk' },
          { name: '3.6 Decision Admitting Uncertainty' },
        ],
      },
      {
        id: 'GEAS-4.0',
        name: '4.0 Engineering Management',
        subtopics: [
          { name: '4.1 Evolution of Management Theory' },
          { name: '4.2 Management and Its Functions' },
          { name: '4.3 Planning, Leading, Organizing, Controlling' },
          { name: '4.4 Managing Product and Service Operations' },
          { name: '4.5 Managing Marketing and Finance Functions' },
        ],
      },
      {
        id: 'GEAS-5.0',
        name: '5.0 Technopreneurship 101',
        subtopics: [
          { name: '5.1 Introduction, Ethics, Social Responsibility' },
          { name: '5.2 Customers and Value Proposition' },
          { name: '5.3 Market Identification and Analysis' },
          { name: '5.4 Creating Competitive Advantage' },
          { name: '5.5 Business Models and Intellectual Property' },
          { name: '5.6 Execution and Business Plan' },
          { name: '5.7 Financial Analysis and Accounting Basics' },
          { name: '5.8 Raising Capital' },
        ],
      },
      {
        id: 'GEAS-6.0',
        name: '6.0 Physics 2',
        subtopics: [
          { name: '6.1 Thermodynamics' },
          { name: '6.2 Electricity and Magnetism' },
          { name: '6.3 EM Induction and Inductance' },
          { name: '6.4 AC Circuits' },
          { name: '6.5 Optics and Atomic/Nuclear Physics' },
        ],
      },
      {
        id: 'GEAS-7.0',
        name: '7.0 Materials Science and Engineering',
        subtopics: [
          { name: '7.1 Atomic Structure and Interatomic Bonding' },
          { name: '7.2 Structure of Crystalline Materials' },
          { name: '7.3 Imperfections in Solids' },
          { name: '7.4 Diffusion in Solids' },
          { name: '7.5 Mechanical Properties of Metals' },
          { name: '7.6 Metal Alloys, Ceramics, Polymers, Composites' },
          { name: '7.7 Electrical, Dielectric, Magnetic, Optical Properties' },
        ],
      },
      {
        id: 'GEAS-8.0',
        name: '8.0 Computer Programming',
        subtopics: [
          { name: '8.1 Object Oriented Programming and UML' },
          { name: '8.2 Object Oriented Analysis and Design' },
          { name: '8.3 Programming Language Fundamentals' },
          { name: '8.4 Exception Handling' },
          { name: '8.5 Graphical User Interface Programming' },
        ],
      },
      {
        id: 'GEAS-9.0',
        name: '9.0 Environment Science and Engineering',
        subtopics: [
          { name: '9.1 Nature and Ecology' },
          { name: '9.2 Natural Systems and Resources' },
          { name: '9.3 Environmental Concerns and Crises' },
          { name: '9.4 Environmental Impact Assessment' },
          { name: '9.5 Sustainable Development' },
        ],
      },
      {
        id: 'GEAS-10.0',
        name: '10.0 ECE Laws, Contracts, Ethics, Standards and Safety',
        subtopics: [
          { name: '10.1 Laws, Obligations and Contracts' },
          { name: '10.2 Pledge of ECE and CSC Guidelines' },
          { name: '10.3 Board Examination Rules' },
          { name: '10.4 Regulating the ECE Profession (PRC)' },
          { name: '10.5 Other ECE Related Statutes' },
          { name: '10.6 Safety Standards and PEC Codes' },
        ],
      },
      {
        id: 'GEAS-11.0',
        name: '11.0 CAD',
        subtopics: [
          { name: '11.1 Introduction to CAD Software' },
          { name: '11.2 Snapping and Construction Elements' },
          { name: '11.3 Dimensioning, Plotting and Image Input' },
        ],
      },
    ],
  },

  // ─── DAY 2 · PM ──────────────────────────────────────────────────────────────
  {
    code: 'EST',
    label: 'Electronics Systems & Technologies',
    weight: 30,
    topics: [
      {
        id: 'EST-1.0',
        name: '1.0 Signals, Spectra, Signal Processing',
        subtopics: [
          { name: '1.1 Classification and Characteristics of Signals' },
          { name: '1.2 Sampling Theorem and Aliasing' },
          { name: '1.3 Difference Equations for FIR and IIR Filters' },
          { name: '1.4 Convolution and Correlation' },
          { name: '1.5 Z-Transforms and Pole-Zero-Gain Filters' },
          { name: '1.6 Fourier Transforms and Filtering' },
        ],
      },
      {
        id: 'EST-2.0',
        name: '2.0 Principles of Communications',
        subtopics: [
          { name: '2.1 Introduction to Communications Systems' },
          { name: '2.2 Noise and Amplitude Modulation' },
          { name: '2.3 Single-Sideband Techniques' },
          { name: '2.4 Frequency Modulation' },
          { name: '2.5 Radio Receivers' },
          { name: '2.6 Radiation and Propagation of Waves' },
          { name: '2.7 Pulse Modulation and Digital Modulation' },
          { name: '2.8 Broadband Communication Systems' },
        ],
      },
      {
        id: 'EST-3.0',
        name: '3.0 Digital Communications',
        subtopics: [
          { name: '3.1 Introduction to Digital Communications' },
          { name: '3.2 Digital Transmission' },
          { name: '3.3 PAM, PWM, PPM, Pulse Code Modulation' },
          { name: '3.4 ASK, FSK, PSK, QAM' },
          { name: '3.5 Basics of Information Theory and Error Detection' },
          { name: '3.6 FDM, TDM, WDM, FDMA, CDMA, TDMA' },
        ],
      },
      {
        id: 'EST-4.0',
        name: '4.0 Transmission and Antenna Systems',
        subtopics: [
          { name: '4.1 Transmission Line Circuits' },
          { name: '4.2 Losses, Parameters, and Matching' },
          { name: '4.3 Smith Chart' },
          { name: '4.4 Radio Wave Propagation' },
          { name: '4.5 Power Density and Field Strength Calculations' },
          { name: '4.6 Antenna Systems' },
          { name: '4.7 Waveguides and Fiber Optics' },
        ],
      },
      {
        id: 'EST-5.0',
        name: '5.0 Electronics 3: Electronic Systems and Design',
        subtopics: [
          { name: '5.1 SCRs, UJT, PUT, TRIAC, DIAC, and Thyristors' },
          { name: '5.2 Optoelectronic Devices and Sensors' },
          { name: '5.3 Transducers and Interfacing Techniques' },
          { name: '5.4 Programmable Logic Controllers' },
          { name: '5.5 Building Management Systems (HVAC, Security, Audio-Video, Fire and Life Safety, SCADA)' },
        ],
      },
      {
        id: 'EST-6.0',
        name: '6.0 Data Communications',
        subtopics: [
          { name: '6.1 Introduction and Categories of Data Communications' },
          { name: '6.2 Configurations and Network Topology' },
          { name: '6.3 Transmission Modes and Synchronization' },
          { name: '6.4 Network Components (Terminals, Multiplexers, Concentrators, FEP, Serial Interface)' },
          { name: '6.5 Security and Cryptography' },
          { name: '6.6 OSI Model and TCP/IP Architecture' },
          { name: '6.7 SNA, Character and Bit-Oriented Protocols' },
          { name: '6.8 LAN, MAN, WAN, GAN, ISDN, B-ISDN' },
        ],
      },
    ],
  },
]

/** Per-subject accent color palette */
export const TOS_SUBJECT_COLORS: Record<string, {
  accent: string
  accentRgb: string
  bg: string
  border: string
  badge: string
}> = {
  MATH: {
    accent:    '#f59e0b',
    accentRgb: '245,158,11',
    bg:        'rgba(245,158,11,0.06)',
    border:    'rgba(245,158,11,0.25)',
    badge:     'rgba(245,158,11,0.15)',
  },
  ELECS: {
    accent:    '#ef4444',
    accentRgb: '239,68,68',
    bg:        'rgba(239,68,68,0.06)',
    border:    'rgba(239,68,68,0.25)',
    badge:     'rgba(239,68,68,0.15)',
  },
  GEAS: {
    accent:    '#3b82f6',
    accentRgb: '59,130,246',
    bg:        'rgba(59,130,246,0.06)',
    border:    'rgba(59,130,246,0.25)',
    badge:     'rgba(59,130,246,0.15)',
  },
  EST: {
    accent:    '#22c55e',
    accentRgb: '34,197,94',
    bg:        'rgba(34,197,94,0.06)',
    border:    'rgba(34,197,94,0.25)',
    badge:     'rgba(34,197,94,0.15)',
  },
}
