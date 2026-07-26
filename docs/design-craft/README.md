# Design craft collection

Human-readable UI and design standards used while building Kink.social.
These started as working notes for consistent product design. They are shared here so reviewers can see the design bar the team aims for.

They are **not** Cursor configuration and **not** required to run the app.

## Guides

| Guide | Folder | Detail file |
|-------|--------|-------------|
| [Card components masterclass](./design-cards-masterclass/README.md) | `design-cards-masterclass` | [reference.md](./design-cards-masterclass/reference.md) |
| [Content blocks masterclass](./design-content-blocks-masterclass/README.md) | `design-content-blocks-masterclass` | [reference.md](./design-content-blocks-masterclass/reference.md) |
| [Desktop app design masterclass](./design-desktop-masterclass/README.md) | `design-desktop-masterclass` | [reference.md](./design-desktop-masterclass/reference.md) |
| [Hero / landing sections masterclass](./design-hero-landing-masterclass/README.md) | `design-hero-landing-masterclass` | [reference.md](./design-hero-landing-masterclass/reference.md) |
| [Large project / complex systems design masterclass](./design-large-projects-masterclass/README.md) | `design-large-projects-masterclass` | [reference.md](./design-large-projects-masterclass/reference.md) |
| [Navigation components masterclass](./design-navigation-masterclass/README.md) | `design-navigation-masterclass` | [reference.md](./design-navigation-masterclass/reference.md) |
| [Phone app design masterclass (iOS + Android)](./design-phone-masterclass/README.md) | `design-phone-masterclass` | [reference.md](./design-phone-masterclass/reference.md) |
| [Web design masterclass (desktop + mobile-first)](./design-web-masterclass/README.md) | `design-web-masterclass` | [reference.md](./design-web-masterclass/reference.md) |

## How to read these

1. Start with **Web design** for overall product UI taste and anti-patterns.
2. Use **Navigation**, **Cards**, **Content blocks**, and **Hero / landing** when reviewing those surfaces.
3. Use **Phone** for mobile organizer tools (door, PWA-style flows).
4. Use **Desktop** only if you are thinking about dense operator tooling.
5. Use **Large projects** for tokens, component layers, and consistency across many screens.

Each guide has a short **Core rules** section. Longer pattern catalogs live in `reference.md`.

## What is not included

- Third-party Stripe plugin skills (vendor docs, not original craft)
- Cursor built-in product skills
- Private automation / agent loop machinery (see [feature-delivery-loop.md](./feature-delivery-loop.md) for a one-page note)

## Origin

Maintained in the private development workspace, then exported here as plain markdown for review.

