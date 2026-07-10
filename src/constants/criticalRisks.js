export const CRITICAL_RISKS_INTRO =
  'Review the critical risks relevant to the job before work begins. Stop work if required controls are not in place.'

export const CRITICAL_RISKS_FOOTER =
  'Always follow the site-specific risk assessment, SSSP and company procedures.'

export const CRITICAL_RISK_CATEGORIES = [
  {
    id: 'excavations',
    title: 'Excavations and trench collapse',
    checks: [
      'Excavation depth, width, and soil type identified',
      'Underground services located and marked before digging',
      'Spoil placed at least 1 m from trench edge',
      'Safe access and egress for all workers',
      'Shoring, benching, or battering assessed for depth and soil',
    ],
    controls: [
      'Use permit-to-dig or excavation plan where required',
      'Keep machines and loads away from trench edges',
      'Install shoring or batter slopes per assessment',
      'Barricade excavations and use edge protection',
      'Competent person inspects before entry and after rain or disturbance',
    ],
    stopWork: [
      'Trench walls showing cracks, movement, or water ingress',
      'Services hit or suspected — stop and report immediately',
      'Shoring damaged, missing, or not per plan',
      'Workers inside unshored trench deeper than 1.5 m without approved controls',
    ],
  },
  {
    id: 'mobile-plant',
    title: 'Mobile plant and people',
    checks: [
      'Exclusion zones marked and communicated',
      'Spotter or communication plan where people work near plant',
      'Reversing alarms, mirrors, and cameras working',
      'Pre-start completed and machine fit for use',
      'Pedestrian routes separated from plant movement',
    ],
    controls: [
      'Keep people out of swing and travel zones',
      'Use spotter when reversing or working in blind areas',
      'Establish one-way traffic and designated loading zones',
      'Wear hi-vis and maintain line of sight with operator',
      'Stop work if exclusion zone cannot be maintained',
    ],
    stopWork: [
      'Person inside machine swing or crush zone without control',
      'Reversing alarm or communication system not working',
      'Operator or spotter cannot see each other clearly',
      'Machine pre-start failed or serious defect reported',
    ],
  },
  {
    id: 'services',
    title: 'Underground and overhead services',
    checks: [
      'Service plans reviewed and on-site markings confirmed',
      'Dial-before-you-dig or equivalent completed',
      'Overhead power lines identified and approach limits known',
      'Safe digging methods agreed (hand dig, vacuum, etc.)',
      'Emergency contacts for service owners available',
    ],
    controls: [
      'Use non-destructive locating before mechanical excavation',
      'Hand dig within 500 mm of marked services',
      'Maintain minimum approach distances to overhead lines',
      'Use tiger tails or barriers where overhead risk exists',
      'Report and isolate if service damaged — do not cover up',
    ],
    stopWork: [
      'Unmarked service found — stop until identified and made safe',
      'Overhead line within approach limit without controls',
      'Gas, water, or electrical leak or strike suspected',
      'Service plans not available for the work area',
    ],
  },
  {
    id: 'lifting',
    title: 'Lifting and suspended loads',
    checks: [
      'Lift plan or method agreed for non-routine lifts',
      'Rigging, chains, and slings inspected and tagged',
      'Load weight and centre of gravity estimated',
      'Exclusion zone under and around lift established',
      'Competent operator and dogman/rigger assigned',
    ],
    controls: [
      'Never stand or work under a suspended load',
      'Use tag lines to control load swing',
      'Keep hands and body clear of pinch points',
      'Inspect lifting gear before each use',
      'Lower load safely if conditions change (wind, ground, stability)',
    ],
    stopWork: [
      'Damaged or untagged lifting equipment',
      'Load weight unknown or exceeds machine capacity',
      'People inside exclusion zone during lift',
      'High wind or unstable ground affecting lift safety',
    ],
  },
  {
    id: 'traffic',
    title: 'Traffic and public interface',
    checks: [
      'Traffic management plan in place where public or site traffic mixes',
      'Signage, cones, and barriers set up before work starts',
      'Pedestrian and cyclist routes considered',
      'Delivery and public access points identified',
      'Workers briefed on traffic interface hazards',
    ],
    controls: [
      'Use spotters and hi-vis at live traffic interfaces',
      'Keep plant and materials out of traffic lanes unless closed',
      'Maintain clear sight lines at crossings and driveways',
      'Communicate changes to traffic layout before implementing',
      'Escort pedestrians through work area if required',
    ],
    stopWork: [
      'Traffic management not set up before work encroaches on road',
      'Public or vehicles entering uncontrolled work zone',
      'Signage or barriers knocked down and not replaced',
      'Night work without adequate lighting and delineation',
    ],
  },
  {
    id: 'unstable-ground',
    title: 'Unstable ground, slopes and embankments',
    checks: [
      'Ground conditions assessed after rain or disturbance',
      'Slope angle and stability reviewed for plant and excavation',
      'Edge of embankment and fill material inspected',
      'Undercutting or surcharge loads identified',
      'Roller or compaction plan matches ground conditions',
    ],
    controls: [
      'Work uphill or across slope — not directly below unstable face',
      'Bench or batter slopes to stable angle per assessment',
      'Keep heavy plant back from unsupported edges',
      'Monitor for cracking, slumping, or water seepage',
      'Reduce load or change method on soft or saturated ground',
    ],
    stopWork: [
      'Visible ground movement, cracking, or slumping',
      'Plant operating on ground that cannot support weight',
      'Working below unsupported cut face or stockpile',
      'Heavy rain making slopes or fill unstable',
    ],
  },
  {
    id: 'water',
    title: 'Working near water',
    checks: [
      'Water depth, flow, and tide conditions assessed',
      'Banks and edges stable for plant and foot access',
      'Rescue and emergency plan agreed',
      'PPE and flotation requirements identified',
      'Environmental controls for sediment and spill',
    ],
    controls: [
      'Keep plant back from soft or undercut banks',
      'Use barriers and signage at water edges',
      'Never work alone near water without communication',
      'Contain sediment and fuel away from watercourse',
      'Stop if water level or flow increases unexpectedly',
    ],
    stopWork: [
      'Bank collapse or erosion under plant or access route',
      'Worker at risk of immersion without rescue plan',
      'Fuel, oil, or sediment entering water',
      'Flood, tide, or flow making work area unsafe',
    ],
  },
  {
    id: 'demolition',
    title: 'Demolition',
    checks: [
      'Structural survey or engineer advice obtained where needed',
      'Services isolated, capped, and verified dead',
      'Asbestos and hazardous materials identified',
      'Collapse zone and exclusion areas marked',
      'Sequence of demolition agreed and briefed',
    ],
    controls: [
      'Demolish in planned sequence — top down or as designed',
      'Keep exclusion zones clear during structural work',
      'Use dust, noise, and debris controls',
      'Secure or remove unstable elements before general demolition',
      'Inspect after each stage before continuing',
    ],
    stopWork: [
      'Unexpected structural instability or unplanned collapse',
      'Asbestos or hazardous material found without controls',
      'Live services not isolated or verified',
      'People inside exclusion or collapse zone',
    ],
  },
  {
    id: 'confined-spaces',
    title: 'Confined spaces',
    checks: [
      'Space assessed — limited entry, poor ventilation, or engulfment risk',
      'Permit and rescue plan in place before entry',
      'Atmospheric testing completed and monitored',
      'Standby person and communication method assigned',
      'Isolation of hazards (energy, flow, materials) confirmed',
    ],
    controls: [
      'Do not enter without approved permit and rescue plan',
      'Continuous monitoring of atmosphere where required',
      'Use mechanical ventilation before and during entry',
      'Standby person never leaves post while entrant inside',
      'Emergency retrieval equipment available and tested',
    ],
    stopWork: [
      'Atmosphere test fails or not completed',
      'No standby person or rescue plan in place',
      'Isolation of hazards not verified',
      'Entrant shows signs of distress or monitor alarm activates',
    ],
  },
]
