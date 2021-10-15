# Sunrise/Sunset Calculator [demo](https://scotthood.co.uk/project/suncalc/demo/)

Simple webpage to find the rough sunrise and sunset times for a given year and location.

First version used the API for https://sunrise-sunset.org/ which was very accurate but I was hitting rate limits pretty quickly. I then adapted to use the equations from [Wikipedia](https://en.wikipedia.org/wiki/Sunrise_equation) which seemed a little too approximate for my location. Final version uses [mourner's suncalc](https://github.com/mourner/suncalc) which after a little tweaking seemed accurate enough.

Uses [Chart.js](https://www.chartjs.org/) to draw the graphs which turned out to be nice and simple. Best fit lines do not come by default and require another package so I just made do with adding some extra dashed lines manually.
