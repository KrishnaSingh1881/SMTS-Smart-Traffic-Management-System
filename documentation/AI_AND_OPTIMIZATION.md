# AI & Optimization

SMTS leverages Local Large Language Models (LLMs) via **Ollama** to provide intelligent traffic control and predictive analytics without requiring a constant internet connection or high cloud costs.

## 🧠 The AI Stack

*   **Engine**: Ollama (Running `llama3` or `mistral`).
*   **Integration**: Custom Prompt Engineering & JSON Parsing.
*   **Data Source**: Real-time `TrafficObservation` and `RoadSegment` state.

## 🚦 Smart Signal Optimization

```mermaid
sequenceDiagram
    participant Opt as SignalOptimizer
    participant DB as Prisma / Postgres
    participant AI as Ollama (Local LLM)
    participant SSE as SSE Emitter

    Opt->>DB: Fetch Congestion & Vehicle Counts
    Opt->>DB: Fetch Current Signal Phases
    Opt->>AI: Send Structured Prompt
    AI-->>Opt: New Timing Recommendations
    Opt->>Opt: Validate Timing Safety
    Opt->>DB: Update TrafficSignal & SignalPhases (Transaction)
    Opt->>DB: Create AuditLog Entry
    Opt->>SSE: Emit 'signal:update' & reasoning tokens
```

The `SignalOptimizer` is responsible for dynamically adjusting the timing of traffic lights to minimize wait times.

### Process Flow:
1.  **Data Gathering**: The optimizer fetches the congestion level and vehicle count for all road segments connected to an intersection.
2.  **Prompt Construction**: A structured prompt is built, containing the current timing and traffic density.
3.  **AI Inference**: Ollama processes the data and suggests a new timing sequence (e.g., extending a Green light if one side has a Gridlock).
4.  **Validation & Application**: The system parses the AI response, validates it for safety (ensuring minimum Green/Yellow times), and applies it to the database.
5.  **Audit Log**: Every AI decision is recorded with a confidence score and a "before vs after" timing snapshot.

### Optimization Schedule:
*   **Standard Intersections**: Checked every **5 minutes**.
*   **High-Priority Intersections**: Checked every **2 minutes**.

## 🔮 Congestion Prediction

The `CongestionPredictor` analyzes historical trends and current incidents to forecast future traffic states.

*   **Prediction Windows**: 15 min, 30 min, and 60 min.
*   **Model Inputs**: Current density, time of day, active incidents (Accidents/Floods), and weather conditions.
*   **Visual Output**: Predicted bottlenecks are highlighted on the map with a "pulsing" warning state.

## 🗣 Natural Language Insights

To ensure human controllers understand AI actions, the system generates **Reasoning Tokens**:
*   *"Optimized Junction A: Extending Green phase by 15s to clear heavy northbound backlog."*
*   *"Anomaly Alert: Sudden density spike detected on Highway 101, suggesting potential unreported debris."*

These insights are streamed to the UI in real-time via Server-Sent Events (SSE).

## 🛡 Safety & Resilience

*   **Manual Override**: Human controllers can "Lock" a signal. The AI will never attempt to optimize a locked signal.
*   **Graceful Degradation**: If the Ollama service is unreachable, the system automatically falls back to the "Default" or "Last Known Good" timing phases.
*   **Transaction Safety**: All timing updates are wrapped in Prisma transactions to prevent partial state updates.
