var key = "X9pkAse76Fgcvlf89qQhod0J5mkl16Fc";

const getWeatherDaily = async (id) => {

  var forecastUrl = `https://dataservice.accuweather.com/forecasts/v1/daily/5day/${id}?apikey=${key}&details=true&language=vi-vn&metric=true`;
  var res = await fetch(forecastUrl);
  var data = await res.json();
  console.log("Daily Weather")
  console.log(data)
  document.getElementById('headline').innerHTML = "Dự Báo: " + data["Headline"]["Text"];
  // document.getElementById('json').innerHTML = JSON.stringify(data, null, 4)
  dailydiv = ''
  for (day of data['DailyForecasts']) {
    var day_date = new Date(day['Date'])
    dailydiv = dailydiv + 
    `
    <p>
    Ngày: ${day_date.getDate()} Tháng ${day_date.getMonth()+1} Năm ${day_date.getFullYear()}<br>
      Nhiệt Độ: ${day['Temperature']['Minimum']['Value']}-${day['Temperature']['Maximum']['Value']}°C <br>
      Ban Ngày: ${day['Day']['IconPhrase']}, khả năng mưa: ${day['Day']['PrecipitationProbability']}%<br>
      Ban Đêm: ${day['Night']['IconPhrase']}, khả năng mưa: ${day['Night']['PrecipitationProbability']}%<br>
    </p>
    `;
  }
  
  document.getElementById('daily').innerHTML = dailydiv
  // return data;
};



const getWeatherHourly = async (id) => {

  
  var forecastUrl = `https://dataservice.accuweather.com/forecasts/v1/hourly/12hour/${id}?apikey=${key}&language=vi-vn&details=true&metric=true`;
  var res = await fetch(forecastUrl);
  var data = await res.json();
  console.log("Hourly Weather")
  console.log(data)
  

  return data;
};

getWeatherDaily(353981)
// getWeatherHourly(353981)

const content = document.querySelector(".content");
// var json = require('./hourly.json');
// console.log(json)