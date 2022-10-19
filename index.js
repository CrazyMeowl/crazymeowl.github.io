var key = "X9pkAse76Fgcvlf89qQhod0J5mkl16Fc";

const getWeatherDaily = async (id) => {

  var forecastUrl = `http://dataservice.accuweather.com/forecasts/v1/daily/5day/${id}?apikey=${key}&details=false&language=vi-vn&metric=true`;
  var res = await fetch(forecastUrl);
  var data = await res.json();
  console.log("Daily Weather")
  console.log(data)
  return data;
};
const getWeatherHourly = async (id) => {

  
  var forecastUrl = `http://dataservice.accuweather.com/forecasts/v1/hourly/12hour/${id}?apikey=${key}&language=vi-vn&details=true&metric=true`;
  var res = await fetch(forecastUrl);
  var data = await res.json();
  console.log("Hourly Weather")
  console.log(data)
  return data;
};

getWeatherDaily(353981)
getWeatherHourly(353981)


// var json = require('./hourly.json');
// console.log(json)