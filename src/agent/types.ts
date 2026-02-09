export type ActionType = 'click' | 'type' | 'scroll' | 'wait' | 'navigate' | 'hover' | 'keypress' | 'rage_click' | 'done' | 'fail';

export interface Action {
    type: ActionType;
    selector?: string;
    text?: string;
    coordinate?: { x: number; y: number };
    duration?: number;
    reason?: string;
    intent?: string;  // For heuristic element search (e.g., "login", "submit")
    key?: string;     // For keypress action (e.g., "Enter", "Escape", "Tab")
}

export interface TestStep {
    name: string; // e.g., "Login"
    goal: string; // e.g., "Login with user demo"
}

export interface TestFlow {
    name: string;
    steps: TestStep[];
}
