import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/docs/landscape")({
  head: () => ({
    meta: [
      { title: "LLM Tools Landscape (2025–2026) — GridArena Docs" },
      {
        name: "description",
        content:
          "State-of-the-art survey of 24 LLM tools for power-system operations published in 2025–2026, with a comparison-at-a-glance table and how GridArena positions itself as an evaluation and benchmarking platform.",
      },
      { property: "og:title", content: "LLM Tools Landscape (2025–2026) — GridArena Docs" },
      {
        property: "og:description",
        content:
          "Survey of 24 LLM tools for power-system operations (2025–2026) and how GridArena fits in as an evaluation harness.",
      },
    ],
  }),
  component: LandscapePage,
});

function LandscapePage() {
  return (
    <>
      <h1>LLM Tools for Power Systems — Landscape (2025–2026)</h1>
      <p>
        This page surveys <strong>24 peer-reviewed and preprint works</strong> on large language
        model (LLM) tools for power-system operations published in 2025 and 2026, and clarifies
        how GridArena positions itself in this landscape. For each tool we list its purpose,
        required inputs, expected outputs, the type of decisions or recommendations it generates,
        and its operational scope and limitations. The comparison-at-a-glance table is constructed
        so that every row maps one-to-one to a numbered reference in the bibliography below.
      </p>

      <h2>1. Landscape of LLM tools (2025–2026)</h2>
      <p>
        The 2025–2026 literature on LLMs for power systems can be grouped into five overlapping
        families: (i) operational agents and co-pilots that take actions or recommend them;
        (ii) optimization- and solver-coupled LLMs that translate natural language into formal
        models; (iii) retrieval-augmented and knowledge-grounded systems for compliance and
        operations and maintenance; (iv) benchmarks and surveys; and (v) domain-specialized
        foundation models and adjacent finance/market work.
      </p>

      <h3>1.1 Operational agents and co-pilots</h3>
      <p>
        <strong>Grid-Agent</strong> [1] is a multi-agent LLM framework that coordinates distributed
        energy resources for grid control, with each agent specialized for a sub-task and a planner
        agent orchestrating the workflow. <strong>GridMind</strong> [2], from Argonne National
        Laboratory, exposes power-system analysis tools (power flow, contingency analysis) to an
        LLM so analysts can ask natural-language questions and receive structured numerical
        answers. The closely named <strong>Grid-Mind</strong> work [3] focuses on connection
        impact assessment, orchestrating multi-fidelity simulations from a single interconnection
        request expressed in natural language.
      </p>
      <p>
        <strong>GAIA</strong> [4], published in <em>Scientific Reports</em>, fine-tunes an LLM for
        advanced power dispatch and couples it with classical dispatch routines — one of the first
        peer-reviewed demonstrations of an LLM acting in the dispatch loop. <strong>Grid CoPilot</strong>{" "}
        [5] targets long-term planning rather than real-time operations.{" "}
        <strong>InstructMPC</strong> [6] keeps a human in the loop and uses LLM-derived
        instructions to adapt model-predictive controllers to context. <strong>PowerDAG</strong>{" "}
        [7], a 2026 preprint, builds an agentic directed-acyclic-graph executor for distribution-
        grid analysis that emphasizes reliability.
      </p>
      <p>
        Beyond these flagship systems, several specialized agents are worth noting. The
        feedback-driven multi-agent framework of Jia et al. [8] focuses on running and debugging
        power-system simulations under LLM control. Hu et al. [9] propose a validation-in-the-loop
        pipeline that converts natural-language descriptions into solver-ready optimization
        problems. Ren et al. [10] integrate LLM agents with a stochastic unit-commitment framework
        to handle wind uncertainty. Yang et al. provide two complementary contributions: an
        LLM-powered automated modeler for active-distribution-network dispatch [11], and an
        LLM-RL collaboration for two-stage voltage control [12]. <strong>LLM4DistReconfig</strong>{" "}
        [13] is a fine-tuned LLM for distribution-network reconfiguration. Behavioral generative
        agents for dispatch and auction [14] explore LLMs as bidders and operators in market
        settings, and the knowledge-driven adaptive method of [15] couples ontologies with LLM
        agents for operations.
      </p>

      <h3>1.2 Optimization and solver-coupled LLMs</h3>
      <p>
        A recurring pattern uses the LLM as a translator between human intent and formal
        mathematical programs. Hu et al. [9] add a validation-in-the-loop step so that solver
        feasibility feedback closes the loop on the LLM's output. LLM4DistReconfig [13] follows
        the same philosophy at the distribution level. The most rigorous evaluation of this
        pattern to date is <strong>ProOPF</strong> [19], a 2026 benchmark that measures LLMs on
        professional-grade optimal power flow modeling and provides automatic feasibility scoring
        of generated models.
      </p>

      <h3>1.3 Retrieval-augmented and knowledge-grounded systems</h3>
      <p>
        <strong>GridCodex</strong> [16], from Huawei, uses retrieval-augmented generation over
        grid codes for compliance reasoning. Cheng et al. [17] extend RAG to operational
        reliability evaluation, retrieving over historical events and standards before answering.
        The virtual-power-plant device failure query model in [18] applies RAG to operations and
        maintenance for fleets of distributed assets. These systems share an explicit limitation:
        they reason over text and do not, by themselves, check physical feasibility.
      </p>

      <h3>1.4 Benchmarks and surveys</h3>
      <p>
        Three works define the current measurement frontier. <strong>ProOPF</strong> [19]
        benchmarks LLMs on OPF modeling. <strong>PFBench</strong> [20] is a 2026 power-flow
        benchmark for LLM-based power-system agent evaluation, hosted on IEEE DataPort. The
        Electric Power Research Institute (EPRI) released the first electric-sector benchmarking
        results for public LLMs in early 2026 [21], and the comprehensive literature survey of
        Sarwar et al. [22] catalogs the field to date.
      </p>

      <h3>1.5 Domain-specialized models and adjacent work</h3>
      <p>
        <strong>EnergyGPT</strong> [23] is a foundation-style LLM specialized for the energy
        sector. On the market side, Cui et al. [24] use LLM-augmented reinforcement learning for
        energy futures trading. These works are not operational agents, but they shape the
        substrate (specialized models, market signals) on which future operational agents will be
        built.
      </p>

      <h2 id="comparison">2. Comparison at a glance</h2>
      <p>
        Each row maps one-to-one to a numbered reference in{" "}
        <a href="#references">Section 4</a>. The final row introduces GridArena explicitly,
        framing it not as another operational agent but as an{" "}
        <strong>evaluation and benchmarking platform</strong>.
      </p>
      <div className="my-6 overflow-x-auto rounded-lg border border-border">
        <table className="!my-0 w-full border-collapse text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="border-b border-border px-3 py-2 text-left font-semibold text-foreground">Tool</th>
              <th className="border-b border-border px-3 py-2 text-left font-semibold text-foreground">Year</th>
              <th className="border-b border-border px-3 py-2 text-left font-semibold text-foreground">Ref</th>
              <th className="border-b border-border px-3 py-2 text-left font-semibold text-foreground">Inputs</th>
              <th className="border-b border-border px-3 py-2 text-left font-semibold text-foreground">Outputs / Decisions</th>
              <th className="border-b border-border px-3 py-2 text-left font-semibold text-foreground">Physical-feasibility check</th>
              <th className="border-b border-border px-3 py-2 text-left font-semibold text-foreground">Key limitations</th>
            </tr>
          </thead>
          <tbody className="[&_td]:border-b [&_td]:border-border [&_td]:px-3 [&_td]:py-2 [&_td]:align-top [&_td]:text-muted-foreground">
            <tr><td className="!text-foreground font-medium">Grid-Agent</td><td>2025</td><td><a href="#ref-1">[1]</a></td><td>Grid topology, DER setpoints, NL operator queries</td><td>Multi-agent control actions; DER coordination</td><td>Implicit — relies on simulator wrapper</td><td>Coordination overhead; opaque inter-agent reasoning</td></tr>
            <tr><td className="!text-foreground font-medium">GridMind (Argonne)</td><td>2025</td><td><a href="#ref-2">[2]</a></td><td>NL questions over power-flow / contingency tools</td><td>Structured numerical answers from registered tools</td><td>Yes — calls deterministic analysis tools</td><td>Analyst Q&amp;A scope, not closed-loop control</td></tr>
            <tr><td className="!text-foreground font-medium">Grid-Mind (CIA)</td><td>2026</td><td><a href="#ref-3">[3]</a></td><td>Interconnection request in natural language</td><td>Multi-fidelity connection impact assessment</td><td>Yes — orchestrates fidelity-tiered simulators</td><td>Single workflow (interconnection), narrow scope</td></tr>
            <tr><td className="!text-foreground font-medium">GAIA</td><td>2025</td><td><a href="#ref-4">[4]</a></td><td>Dispatch context, NL operator instructions</td><td>Dispatch decisions via LLM + classical routines</td><td>Yes — coupled dispatch solver</td><td>Fine-tuned on specific dispatch scope</td></tr>
            <tr><td className="!text-foreground font-medium">Grid CoPilot</td><td>2025</td><td><a href="#ref-5">[5]</a></td><td>Long-term planning datasets, scenario queries</td><td>Capacity-expansion / scenario navigation</td><td>Indirect — planning models, not real-time PF</td><td>Not for real-time operations</td></tr>
            <tr><td className="!text-foreground font-medium">InstructMPC</td><td>2025</td><td><a href="#ref-6">[6]</a></td><td>Operator instructions + MPC state</td><td>Context-adapted MPC control law</td><td>Via MPC controller</td><td>Requires human-in-the-loop</td></tr>
            <tr><td className="!text-foreground font-medium">PowerDAG</td><td>2026</td><td><a href="#ref-7">[7]</a></td><td>Distribution-grid analysis tasks</td><td>Reliability-focused agentic DAG execution</td><td>Yes — tool-grounded execution</td><td>Distribution scope; reliability of agent graph</td></tr>
            <tr><td className="!text-foreground font-medium">Jia et al. (feedback MA)</td><td>2025</td><td><a href="#ref-8">[8]</a></td><td>Simulation specs, debug feedback</td><td>Working power-system simulations</td><td>Yes — simulator-in-the-loop</td><td>Focuses on simulation building, not control</td></tr>
            <tr><td className="!text-foreground font-medium">Hu et al. (NL→solver)</td><td>2025</td><td><a href="#ref-9">[9]</a></td><td>NL optimization problem statement</td><td>Solver-ready optimization model</td><td>Yes — validation-in-the-loop with solver</td><td>Modeling assistant, not operational agent</td></tr>
            <tr><td className="!text-foreground font-medium">Ren et al. (SUC)</td><td>2025</td><td><a href="#ref-10">[10]</a></td><td>Wind/load scenarios, system data</td><td>LLM-orchestrated stochastic unit commitment</td><td>Yes — UC solver</td><td>Scoped to UC under wind uncertainty</td></tr>
            <tr><td className="!text-foreground font-medium">Yang et al. (ADN modeler)</td><td>2025</td><td><a href="#ref-11">[11]</a></td><td>ADN dispatch problem in NL</td><td>Auto-built ADN dispatch model + solution</td><td>Yes — solver-coupled</td><td>Active-distribution-network scope</td></tr>
            <tr><td className="!text-foreground font-medium">Yang et al. (LLM-RL voltage)</td><td>2026</td><td><a href="#ref-12">[12]</a></td><td>ADN voltage state, control objectives</td><td>Two-stage voltage control actions</td><td>Yes — RL environment grounded in PF</td><td>Voltage-control task only</td></tr>
            <tr><td className="!text-foreground font-medium">LLM4DistReconfig</td><td>2025</td><td><a href="#ref-13">[13]</a></td><td>Distribution topology, reconfiguration query</td><td>Switching reconfiguration plan</td><td>Yes — feasibility filtering</td><td>Single task; needs fine-tuning per network</td></tr>
            <tr><td className="!text-foreground font-medium">Behavioral generative agents</td><td>2026</td><td><a href="#ref-14">[14]</a></td><td>Market state, agent personas</td><td>Bidding / dispatch behavior in markets</td><td>Indirect — market simulator</td><td>Behavioral study, not operations control</td></tr>
            <tr><td className="!text-foreground font-medium">Knowledge-driven LLM agents</td><td>2026</td><td><a href="#ref-15">[15]</a></td><td>Ontology + operations queries</td><td>Adaptive operating recommendations</td><td>Partial — ontology-grounded</td><td>Heavily dependent on KB quality</td></tr>
            <tr><td className="!text-foreground font-medium">GridCodex (RAG)</td><td>2025</td><td><a href="#ref-16">[16]</a></td><td>Grid code corpus + compliance question</td><td>Cited compliance reasoning</td><td><strong>No</strong> — text-only</td><td>Cannot detect physical infeasibility</td></tr>
            <tr><td className="!text-foreground font-medium">Cheng et al. (RAG reliability)</td><td>2026</td><td><a href="#ref-17">[17]</a></td><td>Historical events + standards corpus</td><td>Reliability evaluation answers</td><td><strong>No</strong> — text-only</td><td>Same as above</td></tr>
            <tr><td className="!text-foreground font-medium">VPP O&amp;M RAG</td><td>2025</td><td><a href="#ref-18">[18]</a></td><td>Device failure logs, manuals</td><td>Failure-query answers for VPP O&amp;M</td><td><strong>No</strong> — text-only</td><td>Maintenance scope; no physics</td></tr>
            <tr><td className="!text-foreground font-medium">ProOPF (benchmark)</td><td>2026</td><td><a href="#ref-19">[19]</a></td><td>OPF problem descriptions</td><td>LLM-generated optimization models</td><td>Solver feasibility check on generated models</td><td>Scope limited to optimization modeling</td></tr>
            <tr><td className="!text-foreground font-medium">PFBench (benchmark)</td><td>2026</td><td><a href="#ref-20">[20]</a></td><td>Power-flow tasks for agent evaluation</td><td>Pass/fail and accuracy metrics</td><td>Power-flow solver as ground truth</td><td>Single task family (power flow)</td></tr>
            <tr><td className="!text-foreground font-medium">EPRI benchmarking</td><td>2026</td><td><a href="#ref-21">[21]</a></td><td>Electric-sector LLM evaluation suite</td><td>Public LLM benchmark results for the sector</td><td>Static test suite</td><td>Static; not a runtime evaluation harness</td></tr>
            <tr><td className="!text-foreground font-medium">Sarwar et al. (survey)</td><td>2025</td><td><a href="#ref-22">[22]</a></td><td>Literature on LLMs in power systems</td><td>Comprehensive survey</td><td>N/A</td><td>Survey, not a tool</td></tr>
            <tr><td className="!text-foreground font-medium">EnergyGPT</td><td>2025</td><td><a href="#ref-23">[23]</a></td><td>Energy-sector pre-training corpus</td><td>Domain-specialized LLM</td><td>N/A — base model</td><td>Foundation model, not an agent</td></tr>
            <tr><td className="!text-foreground font-medium">Cui et al. (LLM-RL trading)</td><td>2025</td><td><a href="#ref-24">[24]</a></td><td>Energy futures market signals</td><td>RL trading strategies augmented by LLM</td><td>N/A — market scope</td><td>Trading, not operations</td></tr>
            <tr className="bg-primary/5">
              <td className="!text-primary font-semibold">GridArena (this work)</td>
              <td>2026</td>
              <td>—</td>
              <td>Any LLM agent + benchmark case (case5/14/30, CIGRE/IEEE), counterfactual &amp; perturbation jobs, judge prompts</td>
              <td>Audit report: feasibility, robustness, decision-trace and parser provenance, LLM-as-judge scores per action</td>
              <td><strong>Yes</strong> — PyPSA AC/DC power-flow loop on every action</td>
              <td>Evaluation layer, not an operational agent — depends on quality of probes &amp; judges</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>
        Reading the table: rows [1]–[15] are operational or analytical LLM agents that produce
        control or analysis outputs. Rows [16]–[18] (RAG systems) reason over textual knowledge
        bases. Rows [19]–[21] are benchmarks and [22] is a survey. The last row, GridArena, is an
        evaluation platform that wraps any of the above and audits them on physical feasibility
        (via a PyPSA AC/DC power-flow loop), robustness (via counterfactual probes and
        perturbation jobs), and reasoning integrity (decision trace, parser provenance, and
        LLM-as-judge scoring).
      </p>

      <h2>3. How GridArena fits in</h2>
      <p>
        Most tools above are agents that act on the grid. GridArena is deliberately one layer
        above: it is an <strong>evaluation and benchmarking harness</strong> for those agents.
        This positioning addresses three concrete questions — physical feasibility, robustness
        under changing conditions, and failure modes in reasoning or tool use.
      </p>

      <h3>3.1 Physical feasibility</h3>
      <p>
        Every agent action that GridArena observes is replayed through a PyPSA AC/DC power-flow
        simulator. The result — converged or not, line/voltage limits respected or violated —
        is attached to the action as ground truth. This addresses the concern that an LLM may
        produce plausible-sounding but physically infeasible recommendations, a failure mode
        that pure text-based RAG systems [16, 17, 18] cannot detect by themselves.
      </p>

      <h3>3.2 Robustness under changing conditions</h3>
      <p>
        GridArena runs counterfactual probes and perturbation jobs around each baseline run:
        load is scaled, generators are tripped, lines are removed, and the agent is re-queried.
        The platform records whether the agent's recommendation degrades gracefully, switches
        modes appropriately, or breaks. This complements benchmarks like PFBench [20] and ProOPF
        [19], which evaluate single-shot accuracy rather than behavior under stress.
      </p>

      <h3>3.3 Failure modes in reasoning and tool use</h3>
      <p>
        GridArena records a full decision trace for every run: the prompt log, the tool calls,
        the parser provenance for every structured field, and an LLM-as-judge scoring of the
        final recommendation against domain rubrics. Together these surfaces let researchers
        attribute failures to a specific cause — wrong tool selection, misparsed solver output,
        or flawed final reasoning — rather than reporting a single opaque score.
      </p>

      <h3>3.4 Position in the landscape</h3>
      <p>
        In summary, GridArena does not compete with Grid-Agent [1], GridMind [2], GAIA [4], or
        PowerDAG [7]; it <em>consumes</em> them. Any agent exposing an inference endpoint can be
        registered as an engine in GridArena and put through the same physical-feasibility,
        counterfactual, perturbation, and judge pipeline. This makes the platform a natural
        complement to the EPRI [21] and PFBench [20] benchmarking efforts: where those provide
        static test sets, GridArena provides a runtime that turns evaluation into a reproducible
        experiment.
      </p>

      <h2 id="references">4. References</h2>
      <p>
        All 24 references below are dated <strong>2025 or 2026</strong> and have been verified to
        exist via web search at the time of writing. arXiv identifiers, DOIs, and URLs are
        provided for each entry.
      </p>
      <ol className="!my-4 space-y-2 [&_li]:!my-0">
        <li id="ref-1">Y. Zhang, A. M. Saber, A. Youssef, and D. Kundur, "Grid-Agent: An LLM-Powered Multi-Agent System for Power Grid Control," arXiv:2508.05702, Aug. 2025. <a href="https://arxiv.org/abs/2508.05702" target="_blank" rel="noreferrer">arxiv.org/abs/2508.05702</a></li>
        <li id="ref-2">H. Jin, K. Kim, and J. Kwon, "GridMind: LLMs-Powered Agents for Power System Analysis and Operations," Argonne National Laboratory, arXiv:2509.02494, Sep. 2025. <a href="https://arxiv.org/abs/2509.02494" target="_blank" rel="noreferrer">arxiv.org/abs/2509.02494</a></li>
        <li id="ref-3">M. Shamseldein, "Grid-Mind: An LLM-Orchestrated Multi-Fidelity Agent for Automated Connection Impact Assessment," arXiv:2602.20683, 2026. <a href="https://arxiv.org/abs/2602.20683" target="_blank" rel="noreferrer">arxiv.org/abs/2602.20683</a></li>
        <li id="ref-4">Y. Cheng, H. Zhao, X. Zhou, J. Zhao, Y. Cao, C. Yang, and X. Cai, "A large language model for advanced power dispatch (GAIA)," <em>Scientific Reports</em>, vol. 15, art. 91940, 2025. <a href="https://doi.org/10.1038/s41598-025-91940-x" target="_blank" rel="noreferrer">doi.org/10.1038/s41598-025-91940-x</a></li>
        <li id="ref-5">"Grid CoPilot: A Large Language Model (LLM) Based Framework for Transforming Long-Term Planning Analyses," Preprints.org 202504.1464, Apr. 2025. <a href="https://www.preprints.org/manuscript/202504.1464" target="_blank" rel="noreferrer">preprints.org/manuscript/202504.1464</a></li>
        <li id="ref-6">R. Wu, J. Ai, and T. S. Bartels, "InstructMPC: A Human-LLM-in-the-Loop Framework for Context-Aware Power Grid Control," arXiv:2512.05876, Dec. 2025. <a href="https://arxiv.org/abs/2512.05876" target="_blank" rel="noreferrer">arxiv.org/abs/2512.05876</a></li>
        <li id="ref-7">E. O. Badmus and A. Pandey, "PowerDAG: Reliable Agentic AI System for Automating Distribution Grid Analysis," arXiv:2603.17418, Mar. 2026. <a href="https://arxiv.org/abs/2603.17418" target="_blank" rel="noreferrer">arxiv.org/abs/2603.17418</a></li>
        <li id="ref-8">M. Jia, Z. Cui, and G. Hug, "Enhancing LLMs for Power System Simulations: A Feedback-driven Multi-agent Framework," arXiv:2411.16707, May 2025. <a href="https://arxiv.org/abs/2411.16707" target="_blank" rel="noreferrer">arxiv.org/abs/2411.16707</a></li>
        <li id="ref-9">Y. Hu, T. Zhao, and M. Yue, "From Natural Language to Solver-Ready Power System Optimization: An LLM-Assisted, Validation-in-the-Loop Framework," arXiv:2508.08147, Aug. 2025. <a href="https://arxiv.org/abs/2508.08147" target="_blank" rel="noreferrer">arxiv.org/abs/2508.08147</a></li>
        <li id="ref-10">X. Ren, C. S. Lai, G. Taylor, and Z. Guo, "Can Large Language Model Agents Balance Energy Systems?," arXiv:2502.10557, Feb. 2025. <a href="https://arxiv.org/abs/2502.10557" target="_blank" rel="noreferrer">arxiv.org/abs/2502.10557</a></li>
        <li id="ref-11">X. Yang, C. Lin, Y. Yang, Q. Wang, H. Liu, H. Hua, and W. Wu, "Large Language Model Powered Automated Modeling and Optimization of Active Distribution Network Dispatch Problems," arXiv:2507.21162, Jul. 2025. <a href="https://arxiv.org/abs/2507.21162" target="_blank" rel="noreferrer">arxiv.org/abs/2507.21162</a></li>
        <li id="ref-12">X. Yang, C. Lin, X. Ma, D. Liu, R. Zheng, H. Liu, and W. Wu, "Two-Stage Active Distribution Network Voltage Control via LLM-RL Collaboration," arXiv:2602.21715, Feb. 2026. <a href="https://arxiv.org/abs/2602.21715" target="_blank" rel="noreferrer">arxiv.org/abs/2602.21715</a></li>
        <li id="ref-13">P. Christou, M. Z. Islam, Y. Lin, and J. Xiong, "LLM4DistReconfig: A Fine-tuned Large Language Model for Power Distribution Network Reconfiguration," arXiv:2501.14960, Jan. 2025. <a href="https://arxiv.org/abs/2501.14960" target="_blank" rel="noreferrer">arxiv.org/abs/2501.14960</a></li>
        <li id="ref-14">S. Li, J. S. Kim, and C. Chen, "Behavioral Generative Agents for Power Dispatch and Auction," arXiv:2603.08477, 2026. <a href="https://arxiv.org/abs/2603.08477" target="_blank" rel="noreferrer">arxiv.org/abs/2603.08477</a></li>
        <li id="ref-15">"Adaptive Solving Method for Power System Operation Based on Knowledge-Driven LLM Agents," <em>MDPI Electronics</em>, vol. 15, no. 2, art. 478, 2026. <a href="https://www.mdpi.com/2079-9292/15/2/478" target="_blank" rel="noreferrer">mdpi.com/2079-9292/15/2/478</a></li>
        <li id="ref-16">J. Shi, Y. Cheng, F. Zhang, M. Jiang, J. Lin, and Y. Shen (Huawei), "GridCodex: A RAG-Driven AI Framework for Power Grid Code Reasoning and Compliance," arXiv:2508.12682, Aug. 2025. <a href="https://arxiv.org/abs/2508.12682" target="_blank" rel="noreferrer">arxiv.org/abs/2508.12682</a></li>
        <li id="ref-17">Y. Cheng, H. Zhao, D. Xiang, Z. Zhang, G. Liu, Y. Liu, J. Zhao, and X. Cai, "Power system operational reliability evaluation with retrieval-augmented generation enhanced large language model," <em>Energy and AI</em>, vol. 24, art. 100688, May 2026. <a href="https://doi.org/10.1016/j.egyai.2026.100688" target="_blank" rel="noreferrer">doi.org/10.1016/j.egyai.2026.100688</a></li>
        <li id="ref-18">"Implementation of a Device Failure Query Model for the Virtual Power Plant Smart Operation and Maintenance Platform Based on Retrieval-Augmented Generation Technology," <em>MDPI Electronics</em>, vol. 14, no. 22, art. 4502, 2025. <a href="https://www.mdpi.com/2079-9292/14/22/4502" target="_blank" rel="noreferrer">mdpi.com/2079-9292/14/22/4502</a></li>
        <li id="ref-19">C. Shen, Z. Guo, X. Wan, Z. Yang, Y. Zhang, W. Huang, J. Song, Z. Zhang, et al., "ProOPF: Benchmarking and Improving LLMs for Professional-Grade Power Systems Optimization Modeling," arXiv:2602.03070, Feb. 2026. <a href="https://arxiv.org/abs/2602.03070" target="_blank" rel="noreferrer">arxiv.org/abs/2602.03070</a></li>
        <li id="ref-20">B. She, "Power-Flow Benchmark for LLM-based Power System Agent Evaluation (PFBench)," IEEE DataPort, DOI 10.21227/jnrm-q720, Mar. 2026. <a href="https://www.ieee-dataport.org/documents/power-flow-benchmark-llm-based-power-system-agent-evaluation-pfbench" target="_blank" rel="noreferrer">ieee-dataport.org / PFBench</a></li>
        <li id="ref-21">Electric Power Research Institute, "Benchmarking Large Language Models for the Electric Power Sector," EPRI Technical Report 3002034347 / EPRI Journal, Feb. 2026. <a href="https://eprijournal.com/benchmarking-large-language-models-for-the-electric-power-sector/" target="_blank" rel="noreferrer">eprijournal.com / EPRI LLM benchmark</a></li>
        <li id="ref-22">M. Sarwar, M. Rizwan, M. Aziz, and A. R. Sudais, "Large Language Models for Power System Applications: A Comprehensive Literature Survey," arXiv:2512.13004, Dec. 2025. <a href="https://arxiv.org/abs/2512.13004" target="_blank" rel="noreferrer">arxiv.org/abs/2512.13004</a></li>
        <li id="ref-23">"Towards EnergyGPT: A Large Language Model Specialized for the Energy Sector," arXiv:2509.07177, Sep. 2025. <a href="https://arxiv.org/abs/2509.07177" target="_blank" rel="noreferrer">arxiv.org/abs/2509.07177</a></li>
        <li id="ref-24">T. Cui, Y. Ye, Y. Li, N. Du, X. Song, Y. Zhu, and X. Yang, "Toward profitable energy futures trading strategies using reinforcement learning incorporating disagreement and connectedness methods enabled by large language models," <em>Energy and AI</em>, vol. 21, art. 100562, 2025. <a href="https://doi.org/10.1016/j.egyai.2025.100562" target="_blank" rel="noreferrer">doi.org/10.1016/j.egyai.2025.100562</a></li>
      </ol>
    </>
  );
}
