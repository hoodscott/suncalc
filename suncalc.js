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
  let limit = 0;
  while (d.getFullYear() === year && limit < 2) {
    yearArray.push({
      date: new Date(d),
      sunriseUTC: null, sunsetUTC: null,
      sunriseSecs: null, sunsetSecs: null
    });
    d.setDate(d.getDate() + yearResolution);
    limit++;
  }
  return yearArray;
}

function getISODate(date) {
  return date.toISOString().substring(0,10);
}

function twoDigitPad(number) {
  return number.toString().padStart(2, '0');
}

/* Converts string in expected format hh:mm:ss AM/PM to number of seconds since midnight */
function hhmmssToSeconds(hhmmss) {
  const hhmmssArr = hhmmss.split(/:| /);
  return 3600 * parseInt(hhmmssArr[0]) + 60 * parseInt(hhmmssArr[1]) + parseInt(hhmmssArr[2]) + (hhmmssArr[3] == 'PM' ? 12 * 3600 : 0);
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
function calculateSunriseSunset(date, lat, lon) {
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

  console.log(julianSunrise, julianSunset);
  console.log(fromJulianDate(julianSunrise), fromJulianDate(julianSunset));
  return { sunrise: fromJulianDate(julianSunrise), sunset: fromJulianDate(julianSunset)};
}

x = calculateSunriseSunset(new Date(2021,0,4), 55.8642, -4.2518);

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
  
  const BSTBegin = lastSundayInMonth(year, 3);
  const BSTEnd = lastSundayInMonth(year, 10);
  
  /* Set up promises to find the sunrise/sunset times for each week */
  const promises = yearArray.map(week => {
    return fetch(`https://api.sunrise-sunset.org/json?lat=${lat}&lng=${lon}&date=${getISODate(week.date)}`)
      .then(response => response.json())
      .then(data => {
        week.sunriseUTC = data.results.sunrise;
        week.sunsetUTC = data.results.sunset;
        week.sunriseSecs = hhmmssToSeconds(week.sunriseUTC);
        week.sunsetSecs = hhmmssToSeconds(week.sunsetUTC);
        /* DST fix (forward 1 hour at 1am on the last Sunday in March, and back 1 hour at 2am on the last Sunday in October) */
        if (week.date >= BSTBegin && week.date < BSTEnd) {
          week.sunriseSecs -= 3600;
          week.sunsetSecs -= 3600;
        }
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
    
    /* Show graph */
    //todo
  }).catch(err => {
     console.error(err, 'some promises failed');
  });
});

//todo add way to reset
