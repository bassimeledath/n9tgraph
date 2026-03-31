# Fix Cylinder (Datastore) Text Clipping

- [x] Read src/render/shapes.ts cylinder rendering, identify text y-position issue — text centered at y+h/2 ignoring top ellipse safe area
- [x] Fix text y-position to account for top ellipse height, ensure text doesn't clip into curve — pushed text down by ry/2 in shapes.ts, flow-renderer.ts; increased CYLINDER_RIM from 10 to 20 in flow-layout.ts
- [x] npm run build, re-render examples/ci-deploy-pipeline.n9 to verify — build clean, cylinder text correctly centered in safe area
