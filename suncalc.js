const yearResolution = 7;

function findFirstMonday(year) {
  const d = new Date(year,0,1);
  while (d.getDay() != 1) {
    d.setDate(d.getDate() + 1);
  }
  return d;
}

function lastSundayInMonth(year, month) {
  const d = new Date(year, month, 1);
  d.setDate(d.getDate() - 1);
  while (d.getDay() !== 0) {
    d.setDate(d.getDate() - 1);
  }
  return d;
}

function populateYearArray(year) {
  const d = findFirstMonday(year);
  const yearArray = [];
  while (d.getFullYear() === year) {
    yearArray.push({
      date: new Date(d),
      sunriseUTC: null, sunsetUTC: null,
      sunriseSecs: null, sunsetSecs: null
    });
    d.setDate(d.getDate() + yearResolution);
  }
  return yearArray;
}

function getISODate(date) {
  return date.toISOString().substring(0,10);
}

function twoDigitPad(number) {
  return number.toString().padStart(2, '0');
}

/* Converts datetime to number of seconds since midnight */
function secondsSinceMidnight(date) {
  const d = new Date(date);
  return (d.getTime() - d.setHours(0,0,0,0)) / 1000;
}

/* Converts number of seconds since midnight to string formatted like hh:mm:ss (24 hour clock) */
function secondsToHhmmss(seconds) {
  seconds = parseInt(seconds);
  return twoDigitPad(Math.floor(seconds / 3600)) + ':' + 
         twoDigitPad(Math.floor(seconds % 3600 / 60)) + ':' +
         twoDigitPad(seconds % 2600 % 60);
}

function createTableCell(data) {
  let cell = document.createElement('td');
  cell.textContent = data;
  return cell;
}

function degToRad(deg) {
  return deg * Math.PI / 180;
}
function radToDeg(rad) {
  return rad * 180 / Math.PI;
}

/* convert unix ts to number of days (86400000 = 60 * 60 * 24) then add JD for unix ts epoch (1970-01-01) */
function toJulianDate(d) {
  return d.getTime() / 86400000 + 2440587.5;
}
function fromJulianDate(j) {
  return new Date((j - 2440587.5) * 86400000);
}

/* Roughly calculate sunrise and sunset times for a given date, latitude, and longitude using equations from https://en.wikipedia.org/wiki/Sunrise_equation */
async function calculateSunriseSunset(date, lat, lon) {
  /* Date needs to be in Julian date format and latitude in radians */
  const julianDate = toJulianDate(date);
  lat = degToRad(lat);

  const meanSolarTime = Math.ceil(julianDate - 2451545 + 0.0008) - lon / 360;

  const solarMeanAnomaly = degToRad((357.5291 + 0.98560028 * meanSolarTime) % 360);

  const equationOfCentre = 1.9148 * Math.sin(solarMeanAnomaly) + 0.02 * Math.sin(2 * solarMeanAnomaly) + 0.0003 * Math.sin(3 * solarMeanAnomaly);

  const eclipticLongitude = degToRad((solarMeanAnomaly + equationOfCentre + 180
  + 102.9372) % 360);

  const solarTransit = 2451545 + meanSolarTime + 0.0053 * Math.sin(solarMeanAnomaly) - 0.0069 * Math.sin(2 * eclipticLongitude);

  const declinationOfSun = Math.asin(Math.sin(eclipticLongitude) * Math.sin(degToRad(23.44)));

  const hourAngle = radToDeg(Math.acos((Math.sin(degToRad(-0.83)) - Math.sin(lat) * Math.sin(declinationOfSun)) / (Math.cos(lat) * Math.cos(declinationOfSun))));

  const julianSunrise = solarTransit - hourAngle / 360;
  const julianSunset = solarTransit + hourAngle / 360;
  
  return { sunrise: fromJulianDate(julianSunrise), sunset: fromJulianDate(julianSunset)};
}

/* Little wraparound function so we can use above function as a promise */
function calcPromise (date, lat, lon) {
  return new Promise ((resolve) => {
    resolve(SunCalc.getTimes(date, lat, lon));
  });
}

function showGraph(yearArray) {
  /* Get stripped down data arrays (easier to plug into chart.js) */
  const sunrises = yearArray.map(week => [week.date, week.sunriseSecs]);
  const sunsets = yearArray.map(week => [week.date, week.sunsetSecs]);
  
  /* Set up chart.js objects */
  const labels = yearArray.map(week => week.date);
  const data = {
    labels: labels,
    datasets: [
      {
        label: 'Sunrise',
        data: sunrises,
        borderColor: 'rgb(255, 99, 132)', /* red */
        backgroundColor: 'rgb(255, 99, 132, 0.5)',
      },
      {
        label: 'Sunsets',
        data: sunsets,
        borderColor: 'rgb(54, 162, 235)', /* blue */
        backgroundColor: 'rgb(54, 162, 235, 0.5)',
      }
    ]
  };
  const config = {
    type: 'line',
    data: data,
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: 'top',
        },
        tooltip: {
          callbacks: {
            label: context => secondsToHhmmss(context.parsed.y)
          }
        },
      },
      
      scales: {
        x: {
          type: 'time',
          time: {
            tooltipFormat:'DD MMM YYYY'
          },
          title: {
            display: true,
            text: 'Date'
          }
        },
        y: {
          title: {
            display: true,
            text: 'Time'
          },
          ticks: {
            callback: tickValue => secondsToHhmmss(tickValue)
          }
        }
      }
    },
  };
  
  /* Show graph */
  const chartContext = document.getElementById('sungraph').getContext('2d');
  const sunriseChart = new Chart(chartContext, config);
}

/* Prepopulate form after page load */
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('year').setAttribute('value', (new Date()).getFullYear());
  document.getElementById('lat').value = '55.8642';
  document.getElementById('lon').value = '-4.2518';
});

/* Fill in lat/lon data using browser's geolocation */
document.getElementById('get-location').addEventListener('click', () => {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(pos => {
      document.getElementById('lat').value = pos.coords.latitude;
      document.getElementById('lon').value = pos.coords.longitude;
    });
  } else {
    alert("Geolocation is not supported by this browser.");
  }
});

document.getElementById('sunform').addEventListener('submit', e => {
  e.preventDefault();
  const formData = new FormData(e.target);
  const lat = formData.get('lat');
  const lon = formData.get('lon');
  const year = parseInt(formData.get('year'));
  const yearArray = populateYearArray(year);
  
  /* Set up promises to find the sunrise/sunset times for each week */
  const promises = yearArray.map(week => {
    return calcPromise(week.date, lat, lon)
      .then(data => {
        week.sunriseUTC = data.sunrise;
        week.sunsetUTC = data.sunset;
        week.sunriseSecs = secondsSinceMidnight(week.sunriseUTC);
        week.sunsetSecs = secondsSinceMidnight(week.sunsetUTC);
      });
  });
  
  /* Once all promises are complete, we can show the table/graph */
  Promise.all(promises).then(() => {
    /* Hide the form and show the table */
    Array.from(document.getElementsByClassName('form-toggle')).forEach(
      el => el.classList.toggle('hidden')
    );
    
    /* Calculate the average sunrise and sunset times for this year */
    let avgSunrise = yearArray.reduce((total, week) =>
      total + week.sunriseSecs, 0
    );
    avgSunrise /= yearArray.length;
    let avgSunset = yearArray.reduce((total, week) =>
      total + week.sunsetSecs, 0
    );
    avgSunset /= yearArray.length;
    document.getElementById('table-title').textContent = `In ${year} average sunrise is ${secondsToHhmmss(avgSunrise)} and average sunset is ${secondsToHhmmss(avgSunset)}`;
    
    /* Populate the table */
    const table = document.getElementById('suntable');
    yearArray.forEach(week => {
      const row = document.createElement('tr');
      row.appendChild(createTableCell(getISODate(week.date)));
      row.appendChild(createTableCell(secondsToHhmmss(week.sunriseSecs)));
      row.appendChild(createTableCell(secondsToHhmmss(week.sunsetSecs)));
      table.appendChild(row);
    });
    
    /* Populate and show the graph */
    showGraph(yearArray);
  }).catch(err => {
     console.error(err, 'some promises failed');
  });
});

//todo add way to reset
