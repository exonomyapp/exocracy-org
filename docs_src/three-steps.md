# ThreeSteps (3S)

ThreeSteps is the “sovereign follower” app: it carries identity at the edge and engages Conscia nodes over public endpoints.

## Identity (ExoAuth)

ThreeSteps will integrate **ExoAuth** as a portable identity engine:

- generate a **did:peer:2.Vz…** identifier (Ed25519 public key, base58)
- store the corresponding secret locally
- sign payloads for governance actions (Meadowcap capability / petition workflows)

## Conscia engagement (high-level)

ThreeSteps should be able to:

- discover node identity via `/api/discovery`
- query UI + topology hints via `/api/capabilities`
- petition for roles via `/api/capabilities/petition`
- verify assigned permissions via `/api/capabilities/verify`

