# World fill and western outer zone

Task004 is active by explicit owner priority. This is the implementation plan, not a statement that planned content exists. Pre-check failures are recorded in tasks/004-world-fill.md and deferred to R1/R2; new roads still must pass clean-driving and ground checks.

## Measured starting point

Source of truth: coverage-baseline.json, coverage-baseline.svg and scripts/mapcoverage.mjs. Existing bounds x[-300,1060],z[-800,300],1.496km².25m cells with9 area-weighted sub-samples; water excluded from land denominator. EMPTY904,527.78m² / land1,413,763.89m² = **63.980116%**. Repeated live runs agree exactly. Metric limitations and grove/park rules are in the004 report; it conservatively leaves some unregistered paving empty. Inspect each candidate before building; empty-cell bounds are not permission to overwrite existing props or access routes.

The largest connected empty component wraps around existing development (756,361m²); its bounding rectangle spans occupied districts. The largest continuous sampled-flat mostly-empty rectangle is only500x75m at x[-200,300],z[-575,-500]. Existing land has ample scattered infill space, but does not provide a900x700m clear base plus its airstrip. Use existing space first for civilian infill, farms, reserves and services, and reserve one contiguous western extension for the base.

## Extension proposal and constraints

Expand only the west edge: x0=-1500, x1=1060; retain z[-800,300] and2.5m physics grid. New map2560x1100m,2.816km², an increase of1.320km² (88.24%). This is substantial relative to the small starting map, but avoids enlarging both axes or creating an unnecessary ocean/airport duplicate. The military campus and separate airfield together consume most of the added contiguous space. Do not extend farther unless a measured fit/connectivity test justifies it.

Stoneleaf Garrison (fictional) campus: x[-1400,-500],z[-650,50] =900x700m. Airfield immediately north:1000m east-west runway x[-1450,-450],z~-710; fenced support strip to z~-660. Existing civilian runway x[-40,960],z=-705 remains separate with a410m end-to-end gap. The garrison's eastern fence is over250m west of the nearest suburban road. Grade base/airfield pads; keep transitions outside civilian roads. Preserve original terrain samples in the old map except explicitly planned road/pad grading. The current naturalHeight edge-rise would otherwise create giant outer hills: define an outer-zone natural envelope and bounded pad blends rather than extending the old edge-rise formula unchecked.

Terrain render geometry must be culled in chunks while the Rapier heightfield remains continuous and uses the same anti-diagonal split. Preserve getHeight/driveHeight semantics. Initial chunk target128 terrain cells (320m) per side, with camera/frustum culling and conservative fog-distance visibility; measure actual visible calls. Sky already follows the camera and fog already uses local distances, so increasing sky radius/fog range is unnecessary for merely changing world coordinates. MAP-driven physics boundaries move automatically; maps need explicit terrain bounds and a bounded raster resolution instead of a growing origin-centred square canvas.

## Land-use allocation

Coordinates are candidate envelopes, not yet collision-cleared pads. PhaseB tests must establish final footprints, setbacks and access; record adjustments here. Do not count these envelopes as used in coverage until real content is built.

| Region | Planned use and access |
| --- | --- |
| Existing empty northwest band, x[-200,300],z[-575,-290] | First farm/orchard cluster and farm shop, solar rows in remaining flat pockets, rural hamlet/pub/store near the new arterial; preserve civilian airport approach/fence and Airport Rd. |
| Existing outer hills north/west of suburb | Quarry in a graded terraced pocket, ridge wind farm, bush reserve/lookout/tracks; buffers around every existing cul-de-sac and house. |
| Existing empty land south of suburb, z[150,260] | Golf course, camping/caravan park, paddock/homestead pockets, creek and lake with fishing and boats. Preserve the old boundary safety margin. |
| Existing empty south-central land x[300,600],z[85,260] | Second farm cluster, orchard/crops/dam and machinery sheds; a power/water-treatment site toward existing coastal water, with a separate access spur. |
| Existing small empty components inside civilian grids (roughly4,200-10,400m²) | Verify existing paving first, then house/shop infill, sports courts/skate/gym/BBQ/dog/yoga parks and working courtyards; retain parking, shop doors and service access. |
| Industrial fringe north/east and flat pockets beside the rural arterial | Fuel depot, sawmill/log yard, recycling/stealable wrecks, factory/conveyors/forklifts and water treatment, in required industry order. Existing industrial estate stays intact. |
| New west campus and north airfield | Stoneleaf Garrison and separate military aviation operations, all fictional, safe/default flags off. |
| New west south strip x[-1400,-500],z[80,260] | Third farm cluster if needed, rural homesteads/track network, forest windbreaks, service station/rest area and reserve; no unused padding around the base. |
| Thin remaining map margins and district gaps | Actual instanced groves, rocky landscape, creeks/ponds and reserve paths, not just coloured ground. Re-run coverage until unused land<15%. |

## Roads and civilian integration

Stoneleaf Rd (rural80) starts at the existing motorway west junction (330,-252), travels west through the undeveloped northern band and reaches the garrison gate near(-500,-250). Keep it clear of the suburb. Connect farm/industry/hamlet spurs to this arterial and the existing grid; farm/base/quarry tracks40. Access roads are shared road definitions in terrain grading, visible meshes, lane graph, pedestrian paths where appropriate, signs, speed limits and routing. Gravel/dirt sections have shoulders and no urban kerbs. Long flat geometry and smooth grades are preferred; junction turning paths must fit vehicles at their intended speeds. Add unique names per real road, never duplicate an existing name.

BFS from62 must reach every destination via real graph links. Test all new roads at full throttle, zero damage events, no ghost collider and <=1cm visual/physics disagreement. Include junctions/shoulders/bridge ends and both travel directions. Baseline bump failures do not waive these checks.

## Working content phases

1. Farms:2-3 organic clusters with farmhouse/barn/silo/shed/tank/windmill, fences/paddocks, crops/orchard/hay/dam/scarecrow, dogs/cows/sheep. Farmers and safe animal state machines; tractors/harvester row routes with dust and utes on tracks. Farm shop uses existing kit/menu/heal logic, with door/counter colliders and map icon.
2. Industries, one verified site at a time: cooling-tower power/steam; ridge turbines; solar; terraced quarry with haul trucks/excavator/crusher; fuel/tanks/pipes/flare; sawmill/log trucks; recycling/wrecks; factory/conveyors/forklifts/truck bays; water treatment. Every site has workers, paths, ambient audio/night treatment, entrance/signs/maps. Log actual fit problems before skipping anything. Freight rail remains optional after all other acceptance work.
3. Military: perimeter/towers/gate/barrier/guardhouse; parade/fictional flag, HQ/barracks/mess/motor pool/hangars/fuel/bunkers/radar/pads; range/berm/pop-up targets, tank/obstacle courses. Seeded guards/shifts/patrols, squads/drill/PT/range blanks/mess queue/mechanics/officers. Tanks with treads/turrets/recoil, APCs/jeeps/trucks and3-4 vehicle motorway convoys obey lights. Parameterize/reuse airport operations while preserving civilian behavior, then add2-3 fictional fighters, transport, helicopter loops and formation flyovers. No boarding, theft, hostility or damage by default; no explosion objects/real insignia. Trespass toast/approaching guards without default stars. Synth marching/tank/jet/rotor/PA audio through existing master.
4. Civilian fill and population: adult activities (basketball/tennis/football/cricket/frisbee/chess/cards/skate/fishing/kites/BBQ/gym/dogs/yoga/golf/cycling), actual play props and meaningful movement. About200 registered adults, <=50 awake, about60 traffic, <=25 fully simulated; sleep/cull far actors and preserve flee/knockdown/witness/police/pull-over behavior. Delivery/service/taxi/learner/parking/interdistrict trips, boats at sea/lake. Measure caps in the busiest scene, not merely total counts.

## Extension cost and verification gates

Analytical cost before changes: nx544->1024,nz440; terrain triangles478,720->901,120 (+422,400); height samples240,345->452,025 (+211,680, about0.81MiB per float grid). At unchanged non-indexed position/colour/normal format, geometry adds about43.51MiB before chunking/possible indexing. No new light is needed. Chunking increases terrain mesh count, so **draw-call and fps costs remain unverified** until B measurements. Baseline spawn60fps/145calls is not a busiest-scene guarantee. Every extension cost entry in DECISIONS must distinguish calculated geometry from measured runtime results.

GateB: old sample heights/physics regression, boundary containment, maps, terrain continuity and per-scene perf. GateC-E: per-site content/motion/colliders/safety/audio plus roads. GateG: caps/reactions/busiest-scene >=45fps and roughly<600calls. GateH: worldtest full acceptance, serial phantom/bumptest(if present)/brake/phase5 map-pois-signs/shake/music/perfscenes. Keep known deferred failures explicit. Eight total1280x720 screenshots remain unused; capture only at the final visual phase.

## B1 implemented evidence

West-only extent and32 terrain chunks are implemented. All240345original heights retain SHA-2568ab9a9157ef696437bba2dab6b8aef7b28e40e248cee06ad6e1c98049557edd0. All2703360render vertices match the continuous height grid. Expanded-map raster2048x880; full-map/POI/sign tests23/23. Physics boundary moves to x=-1460 (40m inside edge); walker stands on new ground.6180rays including chunk seams show max disagreement0.000123m; Rapier exact-boundary query issue is recorded in004 report. All8terrain checks pass, walk7/7, phase2 16/16, corridor scan7737clean.19-scene performance after extension49-60fps,max366calls; town busiest foot60fps/196calls. These are measurements of the terrain-only extension; farms/base/industries/population are still pending and must fit the same budget after they are added.

Current analysis after B1 (same classifier): **81.372345% unused land**. Added terrain is still bare; the under15% final target has not been met. Keep the original63.980116% baseline fixed for the final before/after report.

## B2 implemented roads and adjusted sites

17gravel roads now join motorway-west(330,-252) through Stoneleaf Rd to the planned gate and western campus grid, with Ridge Access/Creek Valley/Meadow Link returning to town(330,45). Orchard/Harvest/Windmill/Works roads form connected loops; base road limits40, rural connectors80.75junctions have blades (including a collinear name change),107limit signs total; no raised rural kerbs. Roads are actual graph edges, not map-only strokes. All34direction passes complete at full throttle with zero damage; terrain/ghost scans and regression details are in tasks/004-world-fill.md.

Spatial corrections from real collider checks: Riverside Lane runs at z160, south of the existing stadium, not z85. Creek farm becomes a compact80x70m pad centred(535,225), with12m blend, preserving the TV tower and separately-built beach structures; larger farm/orchard clusters remain at(-50,-390) and(-980,170). Bare base/airfield/work pads do not count as used land. Quarry excavation and industry-specific pad changes follow with their site plans. B2 road-only25-scene sweep47-60fps,max369calls; new rural scenes60fps/41-230calls. Content/population costs are still pending.

## C1 built farm land

Gumleaf Orchard Farm(-50,-390), Redbank Fields(-980,170) and Springbank Smallholding(535,225) now have actual structures/fields/paddock fences/dams/yard access and Farm markers. Reused house variants, pitched barns/open sheds, native round silo/tank solids,2265crop instances,63orchard trees and windmill pumps. Six reactive registered farmers work the fields; Gumleaf/Redbank tractors and a Redbank harvester run real fixed-step field circuits with seated visual operators, native solid equipment, interpolated wheels/header, obstacle stops, night lamps and capped dust. Farm sound/shop follow in C2/C3. Field footprints count as cultivated land; empty paddocks/bare grade pads do not. Actual gravel surfaces use1m shoulders in coverage, and oval dam water is ellipse-clipped. These new-content rules preserve original road/water categories and the original baseline.

Three ordinary traffic utes now start at the farms with existing light/signal/collision/theft behavior and rural-route preference. Shared wheel cleanup/actual carjacking/red-green driving verified.26traffic is intermediate; G still owes caps/distance simulation, deliveries/parking and the final population. C2b2 sweep25scenes50-60fps/max381calls, town60fps/206calls; Orchard/Creek Valley full-throttle drives clean both directions with all26traffic+9parked/drivable cars.

C2c adds33actual seeded animals (10cows/20sheep/3farm dogs) in8instanced species/farm batches,132trotting legs, native player solids and soft car knockdown/get-up, no injury/death. Wander/scatter paths clear real solids/dams and stay in paddocks; safe hits/occlusion/gunfire/pause/sleep/native capsule tests pass. Close farm animal views60fps, final25scene47-60fps/max381calls; original gun/witness36/36 pass. Livestock is not yet counted by the coverage adapter; no bare-pad classification shortcut. Farm sound/night fixtures and the enterable shop still follow.

Current unused land **76.1859997%**,2082375m2 /2733277.78m2. This supersedes the interim74.74478%generic-road/water calculation. The world is still far from the final15%target; the military campus, industry and reserves/fill remain pending. C1 farm day/night views58-60fps/44-242calls,25scene sweep51-60fps/max369calls; one shadow light. Static registry870->973boxes/native shapes and orchard trunks+63; terrain remains901120triangles/452025heights.
