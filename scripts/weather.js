var key = "X9pkAse76Fgcvlf89qQhod0J5mkl16Fc";

const getWeatherDaily = async (id) => {

  var forecastUrl = `https://dataservice.accuweather.com/forecasts/v1/daily/5day/${id}?apikey=${key}&details=true&language=vi-vn&metric=true`;
  var res = await fetch(forecastUrl);
  var data = await res.json();
  console.log("Daily Weather")
  console.log(data)
  // document.getElementById('json').innerHTML = JSON.stringify(data, null, 4)
  dailydiv = ''
  data['DailyForecasts'].forEach(function (day, i){
    var day_date = new Date(day['Date'])
    if (i == 0){
      dailydiv += `
      <div class="carousel-item active">
            <svg class="bd-placeholder-img" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" preserveAspectRatio="xMidYMid slice" focusable="false"><rect width="100%" height="100%" fill="#777"/></svg>

            <div class="container">
              <div class="carousel-caption text-start">
                <h1>Dự Báo Hôm Nay Ngày ${day_date.getDate()} Tháng ${day_date.getMonth()+1}:</h1>
                <h2>${data["Headline"]["Text"]}</h2>

                  <div class="row mb-3">
                    <div class="col-6"> Ban Ngày: ${day['Day']['IconPhrase']}, khả năng mưa: ${day['Day']['PrecipitationProbability']}%, Gió hướng ${day['Day']['Wind']['Direction']['Localized']}, Tốc độ gió ${day['Day']['Wind']['Speed']['Value']}KM/H <br></div>
                    <div class="col-6"> Ban Đêm: ${day['Night']['IconPhrase']}, khả năng mưa: ${day['Night']['PrecipitationProbability']}%, Gió hướng ${day['Night']['Wind']['Direction']['Localized']}, Tốc độ gió ${day['Night']['Wind']['Speed']['Value']}KM/H <br></div>
                  </div>
                  <div class="row mb-3">
                    <div class="col-6"> Chất lượng không khí: ${day['AirAndPollen'][0]['Category']}, UV ở mức ${day['AirAndPollen'][5]['Category']} <br></div>
                    <div class="col-6"> Nhiệt Độ: ${day['Temperature']['Minimum']['Value']} - ${day['Temperature']['Maximum']['Value']}°C <br></div>
                  </div>

              </div>
            </div>
          </div>
      `
    } else {
      dailydiv += `
      <div class="carousel-item">
            <svg class="bd-placeholder-img" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" preserveAspectRatio="xMidYMid slice" focusable="false"><rect width="100%" height="100%" fill="#777"/></svg>

            <div class="container">
              <div class="carousel-caption text-start">
                <h1>Dự Báo Ngày ${day_date.getDate()} Tháng ${day_date.getMonth()+1}</h1>

                  <div class="row mb-3">
                    <div class="col-6"> Ban Ngày: ${day['Day']['IconPhrase']}, khả năng mưa: ${day['Day']['PrecipitationProbability']}%, Gió hướng ${day['Day']['Wind']['Direction']['Localized']}, Tốc độ gió ${day['Day']['Wind']['Speed']['Value']}KM/H <br></div>
                    <div class="col-6"> Ban Đêm: ${day['Night']['IconPhrase']}, khả năng mưa: ${day['Night']['PrecipitationProbability']}%, Gió hướng ${day['Night']['Wind']['Direction']['Localized']}, Tốc độ gió ${day['Night']['Wind']['Speed']['Value']}KM/H <br></div>
                  </div>
                  <div class="row mb-3">
                    <div class="col-6"> Chất lượng không khí: ${day['AirAndPollen'][0]['Category']}, UV ở mức ${day['AirAndPollen'][5]['Category']} <br></div>
                    <div class="col-6"> Nhiệt Độ: ${day['Temperature']['Minimum']['Value']} - ${day['Temperature']['Maximum']['Value']}°C <br></div>
                  </div>

              </div>
            </div>
          </div>
      `
    }
  });
  
  document.getElementById('daily').innerHTML = dailydiv
  // return data;
};



const getWeatherHourly = async (id) => {

  
  var forecastUrl = `https://dataservice.accuweather.com/forecasts/v1/hourly/12hour/${id}?apikey=${key}&language=vi-vn&details=true&metric=true`;
  var res = await fetch(forecastUrl);
  var data = await res.json();
  day_of_week = ['Chủ Nhật','Thứ Hai','Thứ Ba','Thứ Tư','Thứ Năm','Thứ Sáu','Thứ Bảy']
  hourlydiv = `
    <div class="row mb-3">
      <div class="col-md-3 themed-grid-col"></div>
      <div class="col-md-9 themed-grid-col"><h1> Dự báo của 12 tiếng tiếp theo <h1></div>
      
    </div>
  `
  for (hour of data){
    date_time = new Date(hour['DateTime'])
    hourlydiv += `
      <div class="row mb-3">
        <div class="col-md-3 themed-grid-col"></div>
        <div class="col-md-1 themed-grid-col">${date_time.getHours()}:00 ${day_of_week[date_time.getDay()]} ${date_time.getDate()}/${date_time.getMonth()+1}</div>
        <div class="col-md-8 themed-grid-col">
          <div class="row">
            <div class="col-md-3 themed-grid-col">Dự báo: ${hour['IconPhrase']}<br> Mây bao phủ: ${hour['CloudCover']}%<br> Tầm nhìn: ${hour['Visibility']['Value']}</div>
            <div class="col-md-3 themed-grid-col">Nhiệt độ: ${hour['Temperature']['Value']}°C<br> Thực: ${hour['RealFeelTemperature']['Value']}°C<br> Cảm Giác: ${hour['RealFeelTemperature']['Phrase']}</div>
          </div>
          <div class="row">
            <div class="col-md-3 themed-grid-col">Hướng gió: ${hour['Wind']['Direction']['Localized']}<br> Tốc độ gió: ${hour['Wind']['Speed']['Value']}KM/H</div>
            <div class="col-md-3 themed-grid-col">Khả Năng Mưa: ${hour['RainProbability']}%<br> Độ Ẩm: ${hour['RelativeHumidity']}%<br> Mức Độ UV: ${hour['UVIndexText']}</div>
          </div>
        </div>
      </div>
    `
  }
  document.getElementById('hourly').innerHTML = hourlydiv

};

getWeatherDaily(353981)
getWeatherHourly(353981)

const content = document.querySelector(".content");
// var json = require('./hourly.json');
// console.log(json)