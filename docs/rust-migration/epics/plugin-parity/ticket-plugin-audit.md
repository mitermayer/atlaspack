# Ticket: JS-Only Plugin Audit and Plan

## Objective

Inventory JS-only plugins, assess risk, and prioritize porting or shimming for Rust orchestrator compatibility.

## Tasks

- Enumerate JS-only plugins and their usage (internal/external); capture owners and criticality.
- Determine whether to port to Rust, shim via host bridge, or deprecate.
- Produce ranked plan with ETA and risks; align with rollout phases.

## Acceptance Criteria

- Published plugin list with status/owner/ETA and risk notes.
- Decisions documented for each plugin (port/shim/deprecate) and linked to tickets.
- Review completed with stakeholders; list consumed by CI contract planning.
