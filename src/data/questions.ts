import type { Question } from "../types";

export const questions = [
  {
    id: "rw-central-idea-001",
    section: "reading-writing",
    domain: "Information and Ideas",
    skill: "Central Ideas and Details",
    difficulty: "easy",
    passage:
      "Ecologist Nia Bell compared fog and tree-water data from redwood groves at different elevations. Over twenty years, the amount of fog collected in lower groves decreased, while the amount collected in higher groves remained nearly constant. During the same period, young trees in the lower groves showed increasing signs of water stress, a pattern not seen in the higher groves.",
    prompt: "Which choice best states the main idea of the text?",
    choices: [
      "A decline in fog at lower elevations is associated with greater water stress in young redwoods there.",
      "Young redwoods generally grow more quickly at high elevations than mature redwoods do.",
      "Fog provides the only source of water available to redwoods in lower-elevation groves.",
      "Redwoods at all elevations have experienced equal changes in water availability.",
    ],
    answerIndex: 0,
    explanation:
      "The text links two elevation-specific trends: fog decreased and sapling water stress increased in lower groves, while neither pattern appeared in higher groves. It does not claim that fog is the trees' only water source.",
  },
  {
    id: "rw-evidence-002",
    section: "reading-writing",
    domain: "Information and Ideas",
    skill: "Command of Evidence",
    difficulty: "medium",
    passage:
      "Biologist Omar Reyes observed that one moth species emerged earlier in spring on some city rooftops than in nearby parks. Reyes hypothesized that rooftop warmth, rather than nighttime artificial light, was responsible for the difference.",
    prompt: "Which finding, if true, would most directly support Reyes's hypothesis?",
    choices: [
      "The moths were more numerous in parks with many flowering plants than on any rooftop.",
      "Among equally illuminated rooftops, moths emerged earlier on warmer roofs than on cooler ones.",
      "Several rooftop moths flew toward lamps shortly after emerging.",
      "The parks contained more moth species overall than the rooftops did.",
    ],
    answerIndex: 1,
    explanation:
      "Holding illumination constant isolates temperature. Earlier emergence on the warmer of equally lit roofs therefore supports warmth as the cause more directly than observations about abundance, diversity, or attraction to lamps do.",
  },
  {
    id: "rw-inference-003",
    section: "reading-writing",
    domain: "Information and Ideas",
    skill: "Inferences",
    difficulty: "medium",
    passage:
      "A public library started lending packets of locally adapted vegetable seeds. In the first year, many packets were borrowed, but few borrowers returned seeds after harvest. The next year, the library offered short workshops on collecting and drying seeds. Borrowing remained steady, and the share of borrowers who returned seeds nearly tripled.",
    prompt: "Which conclusion is best supported by the text?",
    choices: [
      "Most first-year borrowers deliberately kept seeds that they had promised to return.",
      "The workshops likely helped borrowers complete a task they had previously found difficult.",
      "Workshop participants borrowed fewer seed varieties than other library visitors did.",
      "The library's seed supply became unnecessary after the second year.",
    ],
    answerIndex: 1,
    explanation:
      "Seed returns rose sharply after instruction was introduced while borrowing stayed steady. That pattern supports the inference that practical know-how, rather than lack of interest, had limited returns in year one.",
  },
  {
    id: "rw-words-context-004",
    section: "reading-writing",
    domain: "Craft and Structure",
    skill: "Words in Context",
    difficulty: "easy",
    passage:
      "The discovery of ice beneath the crater does not overturn the earlier claim that the region is dry; instead, it qualifies that claim by showing that small reservoirs of water can persist underground.",
    prompt: "As used in the text, what does the word \"qualifies\" most nearly mean?",
    choices: ["Trains", "Limits", "Approves", "Describes"],
    answerIndex: 1,
    explanation:
      "The discovery narrows the scope of the earlier claim without rejecting it: the region is dry, but some underground water remains. In this context, \"qualifies\" means \"limits.\"",
  },
  {
    id: "rw-text-structure-005",
    section: "reading-writing",
    domain: "Craft and Structure",
    skill: "Text Structure and Purpose",
    difficulty: "medium",
    passage:
      "For decades, historians attributed the port's rapid growth mainly to the arrival of the railroad in 1882. Recently digitized shipping logs, however, show that cargo traffic had begun rising six years earlier, after a channel-deepening project allowed larger vessels to dock. The railroad may have accelerated an expansion that was already underway.",
    prompt: "Which choice best describes the function of the shipping logs in the text?",
    choices: [
      "They establish that the railroad caused cargo traffic to decline.",
      "They provide evidence that complicates a traditional explanation of the port's growth.",
      "They show that historians had been unaware of the railroad's arrival date.",
      "They prove that channel deepening was more expensive than railroad construction.",
    ],
    answerIndex: 1,
    explanation:
      "The logs move the start of the growth trend to before the railroad arrived, so they challenge the idea that the railroad alone initiated the expansion. The passage still allows that the railroad contributed later.",
  },
  {
    id: "rw-cross-text-006",
    section: "reading-writing",
    domain: "Craft and Structure",
    skill: "Cross-Text Connections",
    difficulty: "hard",
    passage:
      "Text 1: Wide annual rings in long-lived pines often form during wet years. Because ring widths can be precisely dated, researchers can use them to reconstruct regional rainfall before instruments were available.\n\nText 2: In an irrigated orchard, annual ring width may reflect decisions about watering as much as natural rainfall. Tree-ring records from managed landscapes must therefore be interpreted alongside evidence about land use.",
    prompt: "Based on the texts, both authors would most likely agree with which statement?",
    choices: [
      "Annual ring width can be influenced by the amount of water a tree receives.",
      "Tree rings from orchards provide the most accurate record of regional rainfall.",
      "Researchers should avoid using tree rings that formed before weather instruments existed.",
      "Human activity has no effect on the usefulness of tree-ring records.",
    ],
    answerIndex: 0,
    explanation:
      "Text 1 connects wider rings with wetter years, and Text 2 connects ring width with irrigation. Both therefore treat water availability as an influence, though Text 2 stresses that the source of the water matters when interpreting the record.",
  },
  {
    id: "rw-synthesis-007",
    section: "reading-writing",
    domain: "Expression of Ideas",
    skill: "Rhetorical Synthesis",
    difficulty: "medium",
    passage:
      "A student took these notes:\n• Architect Lina Bo Bardi designed the São Paulo Museum of Art.\n• The design was completed in 1957.\n• Construction was delayed by funding problems.\n• The museum opened in 1968.\n• Its main gallery is suspended above an open public plaza.",
    prompt:
      "The student wants to emphasize the sequence from design to opening. Which choice most effectively uses relevant information from the notes?",
    choices: [
      "The São Paulo Museum of Art includes a gallery suspended above a public plaza.",
      "Lina Bo Bardi, an architect, designed a museum with an open public plaza in São Paulo.",
      "Although Lina Bo Bardi completed the museum's design in 1957, funding delays kept the building from opening until 1968.",
      "Funding problems sometimes affect buildings, including Lina Bo Bardi's São Paulo Museum of Art.",
    ],
    answerIndex: 2,
    explanation:
      "The correct choice directly connects the two relevant dates and explains the delay between them. The other choices omit either the chronology or one of its key events.",
  },
  {
    id: "rw-transitions-008",
    section: "reading-writing",
    domain: "Expression of Ideas",
    skill: "Transitions",
    difficulty: "easy",
    passage:
      "Solar-cell output typically falls as a device ages. In one test of a new perovskite cell, ______, output rose slightly during the first 100 operating cycles before beginning to decline.",
    prompt: "Which choice completes the text with the most logical transition?",
    choices: ["for example", "likewise", "however", "therefore"],
    answerIndex: 2,
    explanation:
      "The test result initially runs counter to the general pattern in the first sentence, so a contrast transition is needed. \"However\" signals that contrast.",
  },
  {
    id: "rw-boundaries-009",
    section: "reading-writing",
    domain: "Standard English Conventions",
    skill: "Boundaries",
    difficulty: "easy",
    passage: "The expedition focused on a single question ______",
    prompt: "Which choice completes the text so that it conforms to Standard English conventions?",
    choices: [
      ": whether microbes could survive beneath the glacier.",
      ", whether microbes could survive beneath the glacier.",
      "; whether microbes could survive beneath the glacier.",
      " whether microbes could survive beneath the glacier.",
    ],
    answerIndex: 0,
    explanation:
      "The words after the blank explain what the single question was, so a colon appropriately introduces that explanation. A semicolon would require an independent clause on both sides.",
  },
  {
    id: "rw-boundaries-010",
    section: "reading-writing",
    domain: "Standard English Conventions",
    skill: "Boundaries",
    difficulty: "hard",
    passage:
      "Early maps placed the island about forty kilometers east of its actual location ______ later surveys corrected the error.",
    prompt: "Which choice completes the text so that it conforms to Standard English conventions?",
    choices: [
      ", however,",
      "; however,",
      "; however",
      ", however",
    ],
    answerIndex: 1,
    explanation:
      "The text contains two independent clauses. A semicolon separates them, and the conjunctive adverb \"however\" is followed by a comma: \"location; however, later surveys...\"",
  },
  {
    id: "rw-agreement-011",
    section: "reading-writing",
    domain: "Standard English Conventions",
    skill: "Subject-Verb Agreement",
    difficulty: "medium",
    passage:
      "A catalog of the sculptor's early sketches ______ how frequently she revised the shapes of her figures before working in stone.",
    prompt: "Which choice completes the text so that it conforms to Standard English conventions?",
    choices: ["reveal", "reveals", "have revealed", "were revealing"],
    answerIndex: 1,
    explanation:
      "The subject is the singular noun \"catalog,\" not the plural noun \"sketches\" inside the prepositional phrase. The singular verb \"reveals\" agrees with the subject and fits the sentence's present tense.",
  },
  {
    id: "rw-modifiers-012",
    section: "reading-writing",
    domain: "Standard English Conventions",
    skill: "Modifiers",
    difficulty: "medium",
    passage:
      "A researcher is describing how a team measured the nighttime activity of desert foxes.",
    prompt: "Which choice most effectively avoids a dangling modifier?",
    choices: [
      "To measure nighttime activity, motion-sensitive cameras were placed beside the foxes' trails.",
      "To measure nighttime activity, the team placed motion-sensitive cameras beside the foxes' trails.",
      "Placed beside the foxes' trails, nighttime activity was measured by motion-sensitive cameras.",
      "The foxes' trails, to measure nighttime activity, had motion-sensitive cameras placed beside them.",
    ],
    answerIndex: 1,
    explanation:
      "The introductory phrase must modify the people performing the measurement. Only the correct choice places \"the team\" immediately after the phrase, making the actor clear.",
  },
  {
    id: "math-linear-equation-001",
    section: "math",
    domain: "Algebra",
    skill: "Linear Equations in One Variable",
    difficulty: "easy",
    prompt: "What is the solution to 3(2x − 5) + 4 = 25?",
    choices: ["4", "5", "6", "7"],
    answerIndex: 2,
    explanation:
      "Distribute and combine like terms: 3(2x − 5) + 4 = 6x − 11. Then 6x − 11 = 25, so 6x = 36 and x = 6.",
  },
  {
    id: "math-system-002",
    section: "math",
    domain: "Algebra",
    skill: "Systems of Linear Equations",
    difficulty: "medium",
    prompt:
      "A theater sold 27 tickets for a performance. Adult tickets cost $14 each, student tickets cost $9 each, and total ticket revenue was $303. How many adult tickets were sold?",
    choices: ["9", "12", "15", "18"],
    answerIndex: 1,
    explanation:
      "Let a be adult tickets and s be student tickets. From a + s = 27 and 14a + 9s = 303, substitute s = 27 − a: 14a + 9(27 − a) = 303, giving 5a = 60 and a = 12.",
  },
  {
    id: "math-inequality-003",
    section: "math",
    domain: "Algebra",
    skill: "Linear Inequalities",
    difficulty: "easy",
    prompt:
      "A storage platform can support at most 480 kilograms. Equipment weighing 135 kilograms is already on it. Each additional crate weighs 23 kilograms. What is the greatest number of additional crates the platform can support?",
    choices: ["14", "15", "16", "21"],
    answerIndex: 1,
    explanation:
      "If n is the number of crates, 135 + 23n ≤ 480. Thus 23n ≤ 345 and n ≤ 15, so at most 15 whole crates can be added.",
  },
  {
    id: "math-quadratic-004",
    section: "math",
    domain: "Advanced Math",
    skill: "Quadratic Functions",
    difficulty: "medium",
    prompt:
      "The height h, in feet, of a launched model rocket t seconds after launch is h(t) = −16t² + 48t + 5. What is the rocket's maximum height?",
    choices: ["37 feet", "41 feet", "48 feet", "53 feet"],
    answerIndex: 1,
    explanation:
      "The maximum occurs at the vertex, where t = −b/(2a) = −48/[2(−16)] = 1.5. Substituting gives h(1.5) = −16(2.25) + 48(1.5) + 5 = 41 feet.",
  },
  {
    id: "math-exponential-005",
    section: "math",
    domain: "Advanced Math",
    skill: "Exponential Functions",
    difficulty: "medium",
    prompt:
      "A bacteria culture initially contains 800 cells and grows by 25% every 3 hours. Which function gives the number of cells, N(t), after t hours?",
    choices: [
      "N(t) = 800(1.25)^(t/3)",
      "N(t) = 800(1.25)^(3t)",
      "N(t) = 800(0.25)^(t/3)",
      "N(t) = 800 + 1.25(t/3)",
    ],
    answerIndex: 0,
    explanation:
      "Each 3-hour interval multiplies the population by 1.25. There are t/3 such intervals in t hours, so the model is 800(1.25)^(t/3).",
  },
  {
    id: "math-polynomial-006",
    section: "math",
    domain: "Advanced Math",
    skill: "Equivalent Expressions and Factors",
    difficulty: "medium",
    prompt:
      "For the polynomial p(x) = x² + kx − 18, x − 3 is a factor. What is the value of k?",
    choices: ["−9", "−3", "3", "9"],
    answerIndex: 2,
    explanation:
      "If x − 3 is a factor, then p(3) = 0. Therefore 3² + 3k − 18 = 0, so 3k − 9 = 0 and k = 3.",
  },
  {
    id: "math-rational-equation-007",
    section: "math",
    domain: "Advanced Math",
    skill: "Nonlinear Equations",
    difficulty: "hard",
    prompt: "If 2/(x − 1) + 1/(x + 1) = 1, what is the sum of all solutions?",
    choices: ["1", "2", "3", "4"],
    answerIndex: 2,
    explanation:
      "Multiply by (x − 1)(x + 1): 2(x + 1) + (x − 1) = x² − 1. This simplifies to x² − 3x − 2 = 0. Neither excluded value, 1 or −1, is a root, and the sum of the roots is 3.",
  },
  {
    id: "math-percent-008",
    section: "math",
    domain: "Problem-Solving and Data Analysis",
    skill: "Percentages",
    difficulty: "hard",
    prompt:
      "A tank contains 30 liters of a solution that is 40% acid by volume. How many liters of water must be added to make the resulting solution 24% acid by volume?",
    choices: ["10", "18", "20", "24"],
    answerIndex: 2,
    explanation:
      "The tank contains 0.40(30) = 12 liters of acid, and adding water does not change that amount. For 12 liters to be 24% of the final volume, the final volume must be 12/0.24 = 50 liters, so 20 liters of water are added.",
  },
  {
    id: "math-sampling-009",
    section: "math",
    domain: "Problem-Solving and Data Analysis",
    skill: "Sampling and Estimation",
    difficulty: "easy",
    prompt:
      "In a random sample of 80 students from a school of 500 students, 52 preferred a later start time. Based on the sample, how many students at the school would be expected to prefer a later start time?",
    choices: ["260", "300", "325", "420"],
    answerIndex: 2,
    explanation:
      "The sample proportion is 52/80 = 0.65. Applying that proportion to 500 students gives 0.65(500) = 325 students.",
  },
  {
    id: "math-probability-010",
    section: "math",
    domain: "Problem-Solving and Data Analysis",
    skill: "Conditional Probability",
    difficulty: "medium",
    passage:
      "A survey recorded how 120 students usually travel to school. Of the 70 seniors surveyed, 28 usually bike. Of the 50 juniors surveyed, 15 usually bike.",
    prompt:
      "If one of the surveyed seniors is selected at random, what is the probability that the selected student usually bikes to school?",
    choices: ["7/30", "7/25", "2/5", "7/13"],
    answerIndex: 2,
    explanation:
      "The condition restricts the sample space to the 70 seniors. Of those, 28 bike, so the probability is 28/70 = 2/5.",
  },
  {
    id: "math-right-triangle-011",
    section: "math",
    domain: "Geometry and Trigonometry",
    skill: "Right Triangle Trigonometry",
    difficulty: "medium",
    prompt:
      "In right triangle ABC, angle C is a right angle, sin A = 5/13, and AC = 24. What is the length of BC?",
    choices: ["5", "10", "26", "60"],
    answerIndex: 1,
    explanation:
      "Since sin A = 5/13, the triangle's opposite, adjacent, and hypotenuse side lengths are in the ratio 5:12:13. Side AC is adjacent to angle A, so 12 scale units equal 24; the scale factor is 2, and BC = 5(2) = 10.",
  },
  {
    id: "math-tangent-012",
    section: "math",
    domain: "Geometry and Trigonometry",
    skill: "Circles in the Coordinate Plane",
    difficulty: "hard",
    prompt:
      "A circle has center (2, −1), and the point (5, 3) lies on the circle. What is the slope of the line tangent to the circle at (5, 3)?",
    choices: ["−4/3", "−3/4", "3/4", "4/3"],
    answerIndex: 1,
    explanation:
      "The radius from (2, −1) to (5, 3) has slope [3 − (−1)]/(5 − 2) = 4/3. A tangent is perpendicular to the radius, so its slope is the negative reciprocal, −3/4.",
  },
] satisfies readonly Question[];
