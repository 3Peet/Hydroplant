var app = require("express")();
var http = require("http").Server(app);
var io = require("socket.io")(http);

var mqtt = require('mqtt');

const MQTT_SERVER = "hairdresser.cloudmqtt.com";
const MQTT_PORT = "15637";
//if your server don't have username and password let blank.
const MQTT_USER = "ksrafjrd";
const MQTT_PASSWORD = "GYWNFZXJgUOZ";

// Web scraping
// const puppeteer = require("puppeteer");

var express = require("express");
const bodyParser = require("body-parser");

// Mongodb Connection
var MongoClient = require('mongodb').MongoClient;
var url = "mongodb://localhost:27017/";


//For write json file
const editJsonFile = require("edit-json-file");
const { getUnpackedSettings } = require("http2");
const e = require("express");
const PORT = process.env.PORT || 8080;
let sw_light_json = editJsonFile(`${__dirname}/src/json/sw-light.json`);
let sw_airpump_json = editJsonFile(`${__dirname}/src/json/sw-airpump.json`);
let schedule_farm = editJsonFile(`${__dirname}/src/json/schedule.json`);
let market_json = editJsonFile(`${__dirname}/src/json/market.json`);
let water_pump_json = editJsonFile(`${__dirname}/src/json/water_pump.json`);
let nutrient_pump_json = editJsonFile(`${__dirname}/src/json/nutrient_pump.json`);
let ph_auto_json = editJsonFile(`${__dirname}/src/json/ph_auto.json`);
let ec_auto_json = editJsonFile(`${__dirname}/src/json/ec_auto.json`);


function timeConverter(UNIX_timestamp) {
  // Use to calculate End date.
  var a = new Date(UNIX_timestamp * 1000);
  var months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  var year = a.getFullYear();
  var month = months[a.getMonth()];
  var date = a.getDate();
  //   var hour = a.getHours();
  //   var min = a.getMinutes();
  //   var sec = a.getSeconds();
  var time =
    // date + " " + month + " " + year + " " + hour + ":" + min + ":" + sec;
    date + " " + month + " " + year;
  return time;
}

function cal_unix_harvest_time(start_date) {
  var data = start_date.split("-");

  var year = parseInt(data[0]);
  var month = parseInt(data[1]);
  var day = parseInt(data[2]);

  unix_year = (year - 1970) * 31556926;
  unix_month = (month - 1) * 2629743.8;
  unix_day = day * 86400;

  unix_45day = 45 * 86400; // 45days of harvest time

  unix_start = unix_year + unix_month + unix_day; // Start date
  unix_done = unix_year + unix_month + unix_day + unix_45day; // End date

  return unix_done;
}

function cal_days_remaining(unix_done) {
  var unix_now = Math.round(new Date().getTime() / 1000);
  var days_remaining = Math.round((unix_done - unix_now) / 86400);
  if (days_remaining <= 0) return 0;
  else return days_remaining;
}

app.set("view engine", "ejs");
app.use(express.static(__dirname + "/public"));

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(bodyParser.raw());

app.get("/", (req, res) => {
  //res.sendFile(__dirname+'/index.html');
  res.render("index");
});

app.get("/chart", (req, res) => {
  res.render("chart");
});

app.get("/control", (req, res) => {
  res.render("control");
});

app.get("/market", (req, res) => {
  res.render("market");
});

app.get("/about", (req, res) => {
  res.render("about");
});

// ---------------------------------------------- Schedule Process ----------------------------------------------

app.post("/start_date_data", (req, res) => {
  if (req.body.start_date == "") {
    console.log("Schedule : No Data");
  } else {
    var data = "";
    data += req.body.start_date;
    schedule_farm.set("start_date", data);
    schedule_farm.save();

    schedule_farm.set(
      "day_remaining",
      cal_days_remaining(cal_unix_harvest_time(data))
    );
    schedule_farm.save();

    console.log("Schedule Status : " + schedule_farm.get("status"));
    console.log("Start date : " + data);
    console.log("End date : " + timeConverter(cal_unix_harvest_time(data)));
    console.log(
      "Days to Harvest : " + cal_days_remaining(cal_unix_harvest_time(data))
    );

    io.sockets.emit(
      "schedule",
      { status: schedule_farm.get("status") },
      { start_date: schedule_farm.get("start_date") },
      { days_remaining: schedule_farm.get("day_remaining") }
    );
  }
});

// ---------------------------------------------- Light Timer ----------------------------------------------
// Function For calculate Time now in Duration of timer - Light & Air Pump
function time_hr_min_to_num(time_hr_min) {
  split_hr_min = time_hr_min.split(":");
  return Number(split_hr_min[0]) * 100 + Number(split_hr_min[1]); // HR -> split_hr_min[0] MIN -> split_hr_min[1]
}

function cal_time_in_duration(start_time, end_time, now_time) {
  if (start_time < end_time) {
    if (start_time <= now_time && now_time <= end_time) {

      return true;
    }
    else {
      return false;
    }
  }
  else if (start_time > end_time) {
    if ((start_time <= now_time && now_time <= 2359) || (0 <= now_time && now_time <= end_time)) {
      return true;
    }
    else {
      return false;
    }
  }
  else if (start_time === end_time) return false;
}

// Route light Timer
app.post('/light_timer', (req, res) => {
  // Receive Start & End Timer
  light_start_time_1 = req.body.light_start_time_1;
  light_end_time_1 = req.body.light_end_time_1;
  light_start_time_2 = req.body.light_start_time_2;
  light_end_time_2 = req.body.light_end_time_2;
  light_start_time_3 = req.body.light_start_time_3;
  light_end_time_3 = req.body.light_end_time_3;
  light_start_time_4 = req.body.light_start_time_4;
  light_end_time_4 = req.body.light_end_time_4;

  // Write timer in sw-light.json
  sw_light_json.set("light_start_time_1", light_start_time_1);
  sw_light_json.set("light_end_time_1", light_end_time_1);
  sw_light_json.set("light_start_time_2", light_start_time_2);
  sw_light_json.set("light_end_time_2", light_end_time_2);
  sw_light_json.set("light_start_time_3", light_start_time_3);
  sw_light_json.set("light_end_time_3", light_end_time_3);
  sw_light_json.set("light_start_time_4", light_start_time_4);
  sw_light_json.set("light_end_time_4", light_end_time_4);
  sw_light_json.save();

  io.sockets.emit("display_light_timer",
    { light_start_time_1: light_start_time_1 },
    { light_end_time_1: light_end_time_1 },
    { light_start_time_2: light_start_time_2 },
    { light_end_time_2: light_end_time_2 },
    { light_start_time_3: light_start_time_3 },
    { light_end_time_3: light_end_time_3 },
    { light_start_time_4: light_start_time_4 },
    { light_end_time_4: light_end_time_4 },
  );
});

// Route Air Pump Timerl
app.post('/airpump_timer', (req, res) => {
  // Receive Start & End Timer
  airpump_start_time_1 = req.body.airpump_start_time_1;
  airpump_end_time_1 = req.body.airpump_end_time_1;
  airpump_start_time_2 = req.body.airpump_start_time_2;
  airpump_end_time_2 = req.body.airpump_end_time_2;
  airpump_start_time_3 = req.body.airpump_start_time_3;
  airpump_end_time_3 = req.body.airpump_end_time_3;
  airpump_start_time_4 = req.body.airpump_start_time_4;
  airpump_end_time_4 = req.body.airpump_end_time_4;

  // Write timer in sw-airpump.json
  sw_airpump_json.set("airpump_start_time_1", airpump_start_time_1);
  sw_airpump_json.set("airpump_end_time_1", airpump_end_time_1);
  sw_airpump_json.set("airpump_start_time_2", airpump_start_time_2);
  sw_airpump_json.set("airpump_end_time_2", airpump_end_time_2);
  sw_airpump_json.set("airpump_start_time_3", airpump_start_time_3);
  sw_airpump_json.set("airpump_end_time_3", airpump_end_time_3);
  sw_airpump_json.set("airpump_start_time_4", airpump_start_time_4);
  sw_airpump_json.set("airpump_end_time_4", airpump_end_time_4);
  sw_airpump_json.save();
  io.sockets.emit("display_airpump_timer",
    { airpump_start_time_1: airpump_start_time_1 },
    { airpump_end_time_1: airpump_end_time_1 },
    { airpump_start_time_2: airpump_start_time_2},
    { airpump_end_time_2: airpump_end_time_2 },
    { airpump_start_time_3: airpump_start_time_3 },
    { airpump_end_time_3: airpump_end_time_3 },
    { airpump_start_time_4: airpump_start_time_4 },
    { airpump_end_time_4: airpump_end_time_4 },
);

});


app.post('/ph_auto',(req,res)=> {
  try {
    ph_start_range = Number(req.body.ph_start_decimal_select + req.body.ph_start_dot_select);
    ph_end_range = Number(req.body.ph_end_decimal_select + req.body.ph_end_dot_select);
    ph_auto_json.set("ph_start_range",ph_start_range);
    ph_auto_json.set("ph_end_range",ph_end_range);
    ph_auto_json.save();

    io.sockets.emit("display_ph_auto",
    { ph_start_range: ph_start_range },
    { ph_end_range: ph_end_range}
  );
    
  } catch (error) {
    console.log(error);
  }
});

app.post('/ec_auto',(req,res)=> {
  try {
    ec_start_range = Number(req.body.ec_start_decimal_select + req.body.ec_start_dot_select);
    ec_end_range = Number(req.body.ec_end_decimal_select + req.body.ec_end_dot_select);
    ec_auto_json.set("ec_start_range",ec_start_range);
    ec_auto_json.set("ec_end_range",ec_end_range);
    ec_auto_json.save();

    io.sockets.emit("display_ec_auto",
    { ec_start_range: ec_start_range },
    { ec_end_range: ec_end_range }
  );
    
  } catch (error) {
    console.log(error);
  }
});

// Global variable Timer Get time now
var now_date = new Date();
var date = now_date.getDate();
var month = now_date.getMonth() + 1;
var year = now_date.getFullYear();
var hour = now_date.getHours();
var minute = now_date.getMinutes();
var second = now_date.getSeconds();

// Global variable Light status value
var manual_light = sw_light_json.get("manual_value");
var timer_light = sw_light_json.get("timer_value");
var result_light = sw_light_json.get("value");

// Global variable Air pump status value
var manual_airpump = sw_airpump_json.get("manual_value");
var timer_airpump = sw_airpump_json.get("timer_value");
var result_airpump = sw_airpump_json.get("value");


// Function Update timer + MongoDB Process [Update every 1 minutes.]
Check_light_airpump_status_timer_manual();
async function Check_light_airpump_status_timer_manual() {
  setInterval(async function () {
    now_date = new Date();
    hour = now_date.getHours();
    minute = now_date.getMinutes();
    timestamp = String(now_date);
    console.log(timestamp);
    result_get_week = getWeekNumber(new Date());
    if (result_get_week[1] < 10) {
      weekstamp = (String(result_get_week[0] + "-W0" + result_get_week[1]));
    }
    else {
      weekstamp = (String(result_get_week[0] + "-W" + result_get_week[1]));
    }

    // ---------------------------------------------- PH & EC Automation ----------------------------------------------
    ph_auto_status = ph_auto_json.get("status");
    ec_auto_status = ec_auto_json.get("status");
    var ph_start_range = ph_auto_json.get("ph_start_range");
    var ph_end_range = ph_auto_json.get("ph_end_range");
    var ec_start_range = ec_auto_json.get("ec_start_range");
    var ec_end_range = ec_auto_json.get("ec_end_range");
    // if(minute%5 === 0){
      if(true && ph_auto_status ){
      console.log("🎆 PH ->" + ph_start_range+":"+ph_end_range);
      if(ph_db < ph_start_range){
        console.log("PH UP | TURN ON");
        client.publish("web/control/ph_up","ON");
        setTimeout(function(){ client.publish("web/control/ph_up","OFF"); }, 4000);
      }

      if(ph_db > ph_end_range){
        console.log("PH DOWN | TURN ON");
        client.publish("web/control/ph_down","ON");
        setTimeout(function(){ client.publish("web/control/ph_down","OFF"); }, 4000);

      }
    }

    if(true && ec_auto_status ){
      console.log("🎍 EC ->" + ec_start_range+":"+ec_end_range);
      if(ec_mscm_db < ec_start_range){
        console.log("EC UP | TURN ON");
        client.publish("web/control/nutrientpump","ON");
        setTimeout(function(){ client.publish("web/control/nutrientpump","OFF"); }, 4000);
      }

      if(ec_mscm_db > ec_end_range){
        console.log("EC DOWN | TURN ON");
        client.publish("web/control/waterpump","ON");
        setTimeout(function(){ client.publish("web/control/waterpump","OFF"); }, 4000);

      }
    }
   

    // ---------------------------------------------- MongoDB Management ----------------------------------------------
    if(minute === 59) {
      client.publish("web/powermode", "HighPower");
    }

    if (minute === 0) {
      if(user_connect_counter < 1 ){
        client.publish("web/powermode", "LowPower");
      }
      console.log("🧔 Database :" + temp_db + " - " + hum_db + " - " + ec_ppm_db + " - " + ec_mscm_db + " - " + water_temp_db + " - " + water_temp_db + " - " + water_level_db + " - " + light_db);
      MongoClient.connect(url, function (err, db) {
        if (err) throw err;
        var dbo = db.db("hydroplant");
        var myobj = {
          temp: temp_db,
          hum: hum_db,
          ec_ppm: ec_ppm_db,
          ec_mscm: ec_mscm_db,
          water_temp: water_temp_db,
          water_level: water_level_db,
          light: light_db, timestamp: timestamp,
          weekstamp: weekstamp
        };
        dbo.collection("sensors").insertOne(myobj, function (err, res) {
          if (err) throw err;
          console.log("1 document inserted");
          db.close();
        });
      });
    }

  // ----------------------------------------------  Update Process Schedule ----------------------------------------------
  // Update At midnight
  if(hour === 0 && minute === 5){
    var start_date_for_update = schedule_farm.get("start_date");
    var plant_status = schedule_farm.get("status");
    if (plant_status == "planting") {
      console.log("Updated Day remaining");
      schedule_farm.set(
        "day_remaining",
        cal_days_remaining(cal_unix_harvest_time(start_date_for_update))
      );
      schedule_farm.save();

      io.sockets.emit(
        "schedule",
        { status: schedule_farm.get("status") },
        { start_date: schedule_farm.get("start_date") },
        { days_remaining: schedule_farm.get("day_remaining") }
      );
    }
  }



    

    // ---------------------------------------------- Timer Proess ----------------------------------------------
    // Light status value
    manual_light = sw_light_json.get("manual_value");
    timer_light = sw_light_json.get("timer_value");
    result_light = sw_light_json.get("value");

    // Air pump status value
    manual_airpump = sw_airpump_json.get("manual_value");
    timer_airpump = sw_airpump_json.get("timer_value");
    result_airpump = sw_airpump_json.get("value");
    // Light Process
    if (manual_light) {
      console.log("💡 Light : Manual ON");
      if (result_light == false) {
        client.publish("web/control/light", "ON");
        sw_light_json.set("value", true);
        sw_light_json.save();
        console.log("💡 Light : Write JSON value -> true");
      }
    }
    else if (timer_light) {
      now_hr_min = String(hour + ":" + minute);
      var light_now_time = now_hr_min;
      var light_start_time_1 = sw_light_json.get("light_start_time_1");
      var light_end_time_1 = sw_light_json.get("light_end_time_1");
      var light_start_time_2 = sw_light_json.get("light_start_time_2");
      var light_end_time_2 = sw_light_json.get("light_end_time_2");
      var light_start_time_3 = sw_light_json.get("light_start_time_3");
      var light_end_time_3 = sw_light_json.get("light_end_time_3");
      var light_start_time_4 = sw_light_json.get("light_start_time_4");
      var light_end_time_4 = sw_light_json.get("light_end_time_4");

      // Filter Null Value
      if (light_start_time_2 == "") {
        light_start_time_2 = "0:0";
        light_end_time_2 = "0:0";
      }
      else if (light_start_time_3 == "") {
        light_start_time_3 = "0:0";
        light_end_time_3 = "0:0";
      }
      else if (light_start_time_4 == "") {
        light_start_time_4 = "0:0";
        light_end_time_4 = "0:0";
      }

      timer_light_no1 = cal_time_in_duration(time_hr_min_to_num(light_start_time_1), time_hr_min_to_num(light_end_time_1), time_hr_min_to_num(light_now_time));
      timer_light_no2 = cal_time_in_duration(time_hr_min_to_num(light_start_time_2), time_hr_min_to_num(light_end_time_2), time_hr_min_to_num(light_now_time));
      timer_light_no3 = cal_time_in_duration(time_hr_min_to_num(light_start_time_3), time_hr_min_to_num(light_end_time_3), time_hr_min_to_num(light_now_time));
      timer_light_no4 = cal_time_in_duration(time_hr_min_to_num(light_start_time_4), time_hr_min_to_num(light_end_time_4), time_hr_min_to_num(light_now_time));

      if (timer_light_no1 || timer_light_no2 || timer_light_no3 || timer_light_no4) {
        console.log("💡 Light : Timer ON");
        if (result_light == false) {
          client.publish("web/control/light", "ON");
          sw_light_json.set("value", true);
          sw_light_json.save();
          console.log("💡 Light : Write JSON Timer value -> true");
        }
      }
      else {
        console.log("💡 Light : Timer OFF");
        if (result_light == true) {
          client.publish("web/control/light", "OFF");
          sw_light_json.set("value", false);
          sw_light_json.save();
          console.log("💡 Light : Write JSON Timer value -> false");
        }
      }
    }
    else if (!timer_light) {
      console.log("💡 Light : Manual OFF");
      if (result_light == true) {
        client.publish("web/control/light", "OFF");
        sw_light_json.set("value", false);
        sw_light_json.save();
        console.log("💡 Light: Write JSON value : false");
      }
    }

    // Air Pump Process
    if (manual_airpump) {
      console.log("🧊 Air Pump : Manual ON");
      if (result_airpump == false) {
        client.publish("web/control/airpump", "ON");
        sw_airpump_json.set("value", true);
        sw_airpump_json.save();
        console.log("🧊 Air Pump : Write JSON value -> true");
      }
    }
    else if (timer_airpump) {
      now_hr_min = String(hour + ":" + minute);
      var airpump_now_time = now_hr_min;
      var airpump_start_time_1 = sw_airpump_json.get("airpump_start_time_1");
      var airpump_end_time_1 = sw_airpump_json.get("airpump_end_time_1");
      var airpump_start_time_2 = sw_airpump_json.get("airpump_start_time_2");
      var airpump_end_time_2 = sw_airpump_json.get("airpump_end_time_2");
      var airpump_start_time_3 = sw_airpump_json.get("airpump_start_time_3");
      var airpump_end_time_3 = sw_airpump_json.get("airpump_end_time_3");
      var airpump_start_time_4 = sw_airpump_json.get("airpump_start_time_4");
      var airpump_end_time_4 = sw_airpump_json.get("airpump_end_time_4");

      // Filter Null Value
      if (airpump_start_time_2 == "") {
        airpump_start_time_2 = "0:0";
        airpump_end_time_2 = "0:0";
      }
      else if (airpump_start_time_3 == "") {
        airpump_start_time_3 = "0:0";
        airpump_end_time_3 = "0:0";
      }
      else if (airpump_start_time_4 == "") {
        airpump_start_time_4 = "0:0";
        airpump_end_time_4 = "0:0";
      }

      timer_airpump_no1 = cal_time_in_duration(time_hr_min_to_num(airpump_start_time_1), time_hr_min_to_num(airpump_end_time_1), time_hr_min_to_num(airpump_now_time));
      timer_airpump_no2 = cal_time_in_duration(time_hr_min_to_num(airpump_start_time_2), time_hr_min_to_num(airpump_end_time_2), time_hr_min_to_num(airpump_now_time));
      timer_airpump_no3 = cal_time_in_duration(time_hr_min_to_num(airpump_start_time_3), time_hr_min_to_num(airpump_end_time_3), time_hr_min_to_num(airpump_now_time));
      timer_airpump_no4 = cal_time_in_duration(time_hr_min_to_num(airpump_start_time_4), time_hr_min_to_num(airpump_end_time_4), time_hr_min_to_num(airpump_now_time));

      if (timer_airpump_no1 || timer_airpump_no2 || timer_airpump_no3 || timer_airpump_no4) {
        console.log("🧊 Air Pump : Timer ON");
        if (result_airpump == false) {
          client.publish("web/control/airpump", "ON");
          sw_airpump_json.set("value", true);
          sw_airpump_json.save();
          console.log("🧊 Air Pump : Write JSON Timer value -> true");
        }
      }
      else {
        console.log("🧊 Air Pump : Timer OFF");
        if (result_airpump == true) {
          client.publish("web/control/airpump", "OFF");
          sw_airpump_json.set("value", false);
          sw_airpump_json.save();
          console.log("🧊 Air Pump : Write JSON Timer value -> false");
        }
      }
    }
    else if (!timer_airpump) {
      console.log("🧊 Air Pump : Manual OFF");
      if (result_airpump == true) {
        client.publish("web/control/airpump", "OFF");
        sw_airpump_json.set("value", false);
        sw_airpump_json.save();
        console.log("🧊 Air Pump: Write JSON value : false");
      }
    }
    console.log("⏰ Update Time : " + hour + ":" + minute);
    console.log("<------------------------------------->");
  }, 60000);
}

// ---------------------------------------------- Socket io ----------------------------------------------
var user_connect_counter = 0;
io.on("connect", function (socket) {
  // Powermode ESP32
  user_connect_counter++;
  console.log("Number of users 🙋‍♂️: "+ user_connect_counter);
  if(user_connect_counter === 1){
    client.publish("web/powermode", "HighPower");
    console.log("ESP32 MODE : HIGH POWER 🔋")
  }
  // Powermode ESP32
  socket.on('disconnect', () => {
    user_connect_counter--;
    console.log("Number of users 🙋‍♂️: "+ user_connect_counter);
    if(user_connect_counter < 1){
      client.publish("web/powermode", "LowPower");
      console.log("ESP32 MODE : LOW POWER 🔋")
    }
  });

  socket.on("state_light_manual", function (data) {
    client.publish("web/control/light", data ? "ON" : "OFF");
    sw_light_json.set("manual_value", data);
    sw_light_json.set("value", data);
    sw_light_json.save();
  });

  socket.on("state_light_timer", function (data) {
    sw_light_json.set("timer_value", data);
    sw_light_json.save();
  });

  socket.on("state_airpump_manual", function (data) {
    client.publish("web/control/airpump", data ? "ON" : "OFF");
    sw_airpump_json.set("manual_value", data);
    sw_airpump_json.set("value", data);
    sw_airpump_json.save();
  });

  socket.on("state_airpump_timer", function (data) {
    sw_airpump_json.set("timer_value", data);
    sw_airpump_json.save();
  });

  socket.on("schedule_status", function (data) {
    schedule_farm.set("status", data);
    schedule_farm.save();
  });

  socket.on("water_pump", function (data) {
    client.publish("web/control/waterpump", data ? "ON" : "OFF");
    water_pump_json.set("status", data);
    water_pump_json.save();
  });

  socket.on("nutrient_pump", function (data) {
    client.publish("web/control/nutrientpump", data ? "ON" : "OFF");
    nutrient_pump_json.set("status", data);
    nutrient_pump_json.save();
  });

  socket.on("phup_pump", function (data) {
    client.publish("web/control/ph_up", data ? "ON" : "OFF");
  });

  socket.on("phdown_pump", function (data) {
    client.publish("web/control/ph_down", data ? "ON" : "OFF");
  });

  
  socket.on("state_ph_auto", function (data) {
    ph_auto_json.set("status", data);
    ph_auto_json.save();
  });

  socket.on("state_ec_auto", function (data) {
    ec_auto_json.set("status", data);
    ec_auto_json.save();
  });

  // MQTT Light Timer
  socket.on("mqtt_light_timer", function (data) {
    control_timer(data, "NULL");
  });

  socket.on("mqtt_airpump_timer", function (data) {
    control_timer("NULL", data);
  });

  io.sockets.emit("ShowGreenOakPrices", {
    prices: market_json.get("green_oak"),
  });

  io.sockets.emit("all_ctrl_sw_data",
    { light_manual_sw_status: sw_light_json.get("manual_value") },
    { light_timer_sw_status: sw_light_json.get("timer_value") },
    { airpump_manual_sw_status: sw_airpump_json.get("manual_value") },
    { airpump_timer_sw_status: sw_airpump_json.get("timer_value") },
    { auto_ph_status: ph_auto_json.get("status") },
    { auto_ec_status: ec_auto_json.get("status") }
  );

  io.sockets.emit("display_ph_auto",
    { ph_start_range: ph_auto_json.get("ph_start_range") },
    { ph_end_range: ph_auto_json.get("ph_end_range") }
  );

  io.sockets.emit("display_ec_auto",
    { ec_start_range: ec_auto_json.get("ec_start_range") },
    { ec_end_range: ec_auto_json.get("ec_end_range") }
  );

  io.sockets.emit("display_light_timer",
    { light_start_time_1: sw_light_json.get("light_start_time_1") },
    { light_end_time_1: sw_light_json.get("light_end_time_1") },
    { light_start_time_2: sw_light_json.get("light_start_time_2") },
    { light_end_time_2: sw_light_json.get("light_end_time_2") },
    { light_start_time_3: sw_light_json.get("light_start_time_3") },
    { light_end_time_3: sw_light_json.get("light_end_time_3") },
    { light_start_time_4: sw_light_json.get("light_start_time_4") },
    { light_end_time_4: sw_light_json.get("light_end_time_4") },
  );

  io.sockets.emit("display_airpump_timer",
    { airpump_start_time_1: sw_airpump_json.get("airpump_start_time_1") },
    { airpump_end_time_1: sw_airpump_json.get("airpump_end_time_1") },
    { airpump_start_time_2: sw_airpump_json.get("airpump_start_time_2") },
    { airpump_end_time_2: sw_airpump_json.get("airpump_end_time_2") },
    { airpump_start_time_3: sw_airpump_json.get("airpump_start_time_3") },
    { airpump_end_time_3: sw_airpump_json.get("airpump_end_time_3") },
    { airpump_start_time_4: sw_airpump_json.get("airpump_start_time_4") },
    { airpump_end_time_4: sw_airpump_json.get("airpump_end_time_4") },
  );

  io.sockets.emit(
    "schedule",
    { status: schedule_farm.get("status") },
    { start_date: schedule_farm.get("start_date") },
    { days_remaining: schedule_farm.get("day_remaining") }
  );
  // console.log("Status : " + schedule_farm.get("status"));

  // Get salad Prices XXX DON't DELETE XXX
  // async function getPrice(url, Xpath) {
  //   const browser = await puppeteer.launch();
  //   const page = await browser.newPage();
  //   await page.goto(url);

  //   const [el] = await page.$x(Xpath); //Get Xpath
  //   const txt = await el.getProperty("textContent");
  //   const price = await txt.jsonValue();

  //   browser.close();

  //   return price.trim();
  // }

  socket.on("GetGreenOakPrices", async function (url, Xpath) {
    var price_greenoak = await getPrice(url, Xpath);
    console.log("Green Oak Price : " + price_greenoak + " THB");
    market_json.set("green_oak", price_greenoak);
    market_json.save();
    console.log(market_json.get("green_oak"));
  });
});


app.get("/sw-light", (req, res) => {
  res.json(sw_light_json);
});

app.get("/sw-airpump", (req, res) => {
  res.json(sw_airpump_json);
});

app.get("/water-pump", (req, res) => {
  res.json(water_pump_json);
});

app.get("/nutrient-pump", (req, res) => {
  res.json(nutrient_pump_json);
});

// Update Every 12hr
// Update_Day_remaining();
// async function Update_Day_remaining() {
//   setInterval(function () {
//     console.log("Update Day remaining");

//     var start_date_for_update = schedule_farm.get("start_date");
//     var plant_status = schedule_farm.get("status");

//     if (plant_status == "planting") {
//       console.log("Updated Day remaining");
//       schedule_farm.set(
//         "day_remaining",
//         cal_days_remaining(cal_unix_harvest_time(start_date_for_update))
//       );
//       schedule_farm.save();

//       io.sockets.emit(
//         "schedule",
//         { status: schedule_farm.get("status") },
//         { start_date: schedule_farm.get("start_date") },
//         { days_remaining: schedule_farm.get("day_remaining") }
//       );
//     };

//   }, 43200000);
// }

// ---------------------------------------------- Charts Process Route ----------------------------------------------
app.post("/graph_days_process", (req, res) => {
  var months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  data_date = req.body.date_charts.split("-");
  year_charts = data_date[0];
  month_charts = months[Number(data_date[1])-1];
  day_charts = data_date[2];
  console.log("Year: " + year_charts + " Month: " + month_charts + " Days: " + day_charts);
  MongoClient.connect(url, function (err, db) {
    if (err) throw err;
    var dbo = db.db("hydroplant");
    var query = { timestamp: new RegExp('.*'+month_charts+' '+day_charts+' '+year_charts+'.*')};
    console.log(query);
    // var query = { timestamp: new RegExp('^' + Number(day_charts) + "-" + Number(month_charts) + "-" + Number(year_charts)) };
    var projection = { projection: { _id: 0,ph:1, temp: 1, hum: 1, ph: 1,ec_mscm:1, water_temp:1, light:1, water_level:1, timestamp: 1 } }
    dbo.collection("sensors").find(query, projection).toArray(function (err, result) {
      if (err) throw err;
      console.log(result);
      io.sockets.emit("charts_process", {
        value: result
      });
      db.close();
    });
  });

});

app.post("/graph_week_process", (req, res) => {
  console.log(req.body);
});

app.post("/graph_months_process", (req, res) => {
  console.log(req.body);
});


function getWeekNumber(d) {
  // Copy date so don't modify original
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  // Set to nearest Thursday: current date + 4 - current day number
  // Make Sunday's day number 7
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  // Get first day of year
  var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  // Calculate full weeks to nearest Thursday
  var weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  // Return array of year and week number
  return [d.getUTCFullYear(), weekNo];
}


function control_timer(timer_light_data, timer_airpump_data) {
  now_date = new Date();
  hour = now_date.getHours();
  minute = now_date.getMinutes();

  // Light status value
  manual_light = sw_light_json.get("manual_value");
  timer_light = timer_light_data;
  result_light = sw_light_json.get("value");

  // Air pump status value
  manual_airpump = sw_airpump_json.get("manual_value");
  timer_airpump = timer_airpump_data;
  result_airpump = sw_airpump_json.get("value");

  if (timer_light === "NULL") {
    timer_light = sw_light_json.get("timer_value");
  }

  if (timer_airpump === "NULL") {
    timer_airpump = sw_airpump_json.get("timer_value");
  }

  // Light Process
  if (manual_light) {
    console.log("💡 Light : Manual ON");
    if (result_light == false) {
      client.publish("web/control/light", "ON");
      sw_light_json.set("value", true);
      sw_light_json.save();
      console.log("💡 Light : Write JSON value -> true");
    }
  }
  else if (timer_light) {
    now_hr_min = String(hour + ":" + minute);
    var light_now_time = now_hr_min;
    var light_start_time_1 = sw_light_json.get("light_start_time_1");
    var light_end_time_1 = sw_light_json.get("light_end_time_1");
    var light_start_time_2 = sw_light_json.get("light_start_time_2");
    var light_end_time_2 = sw_light_json.get("light_end_time_2");
    var light_start_time_3 = sw_light_json.get("light_start_time_3");
    var light_end_time_3 = sw_light_json.get("light_end_time_3");
    var light_start_time_4 = sw_light_json.get("light_start_time_4");
    var light_end_time_4 = sw_light_json.get("light_end_time_4");

    // Filter Null Value
    if (light_start_time_2 == "") {
      light_start_time_2 = "0:0";
      light_end_time_2 = "0:0";
    }
    else if (light_start_time_3 == "") {
      light_start_time_3 = "0:0";
      light_end_time_3 = "0:0";
    }
    else if (light_start_time_4 == "") {
      light_start_time_4 = "0:0";
      light_end_time_4 = "0:0";
    }

    timer_light_no1 = cal_time_in_duration(time_hr_min_to_num(light_start_time_1), time_hr_min_to_num(light_end_time_1), time_hr_min_to_num(light_now_time));
    timer_light_no2 = cal_time_in_duration(time_hr_min_to_num(light_start_time_2), time_hr_min_to_num(light_end_time_2), time_hr_min_to_num(light_now_time));
    timer_light_no3 = cal_time_in_duration(time_hr_min_to_num(light_start_time_3), time_hr_min_to_num(light_end_time_3), time_hr_min_to_num(light_now_time));
    timer_light_no4 = cal_time_in_duration(time_hr_min_to_num(light_start_time_4), time_hr_min_to_num(light_end_time_4), time_hr_min_to_num(light_now_time));

    if (timer_light_no1 || timer_light_no2 || timer_light_no3 || timer_light_no4) {
      console.log("💡 Light : Timer ON");
      if (result_light == false) {
        client.publish("web/control/light", "ON");
        sw_light_json.set("value", true);
        sw_light_json.save();
        console.log("💡 Light : Write JSON Timer value -> true");
      }
    }
    else {
      console.log("💡 Light : Timer OFF");
      if (result_light == true) {
        client.publish("web/control/light", "OFF");
        sw_light_json.set("value", false);
        sw_light_json.save();
        console.log("💡 Light : Write JSON Timer value -> false");
      }
    }
  }
  else if (!timer_light) {
    console.log("💡 Light : Manual OFF");
    if (result_light == true) {
      client.publish("web/control/light", "OFF");
      sw_light_json.set("value", false);
      sw_light_json.save();
      console.log("💡 Light: Write JSON value : false");
    }
  }

  // Air Pump Process
  if (manual_airpump) {
    console.log("🧊 Air Pump : Manual ON");
    if (result_airpump == false) {
      client.publish("web/control/airpump", "ON");
      sw_airpump_json.set("value", true);
      sw_airpump_json.save();
      console.log("🧊 Air Pump : Write JSON value -> true");
    }
  }
  else if (timer_airpump) {
    now_hr_min = String(hour + ":" + minute);
    var airpump_now_time = now_hr_min;
    var airpump_start_time_1 = sw_airpump_json.get("airpump_start_time_1");
    var airpump_end_time_1 = sw_airpump_json.get("airpump_end_time_1");
    var airpump_start_time_2 = sw_airpump_json.get("airpump_start_time_2");
    var airpump_end_time_2 = sw_airpump_json.get("airpump_end_time_2");
    var airpump_start_time_3 = sw_airpump_json.get("airpump_start_time_3");
    var airpump_end_time_3 = sw_airpump_json.get("airpump_end_time_3");
    var airpump_start_time_4 = sw_airpump_json.get("airpump_start_time_4");
    var airpump_end_time_4 = sw_airpump_json.get("airpump_end_time_4");

    // Filter Null Value
    if (airpump_start_time_2 == "") {
      airpump_start_time_2 = "0:0";
      airpump_end_time_2 = "0:0";
    }
    else if (airpump_start_time_3 == "") {
      airpump_start_time_3 = "0:0";
      airpump_end_time_3 = "0:0";
    }
    else if (airpump_start_time_4 == "") {
      airpump_start_time_4 = "0:0";
      airpump_end_time_4 = "0:0";
    }

    timer_airpump_no1 = cal_time_in_duration(time_hr_min_to_num(airpump_start_time_1), time_hr_min_to_num(airpump_end_time_1), time_hr_min_to_num(airpump_now_time));
    timer_airpump_no2 = cal_time_in_duration(time_hr_min_to_num(airpump_start_time_2), time_hr_min_to_num(airpump_end_time_2), time_hr_min_to_num(airpump_now_time));
    timer_airpump_no3 = cal_time_in_duration(time_hr_min_to_num(airpump_start_time_3), time_hr_min_to_num(airpump_end_time_3), time_hr_min_to_num(airpump_now_time));
    timer_airpump_no4 = cal_time_in_duration(time_hr_min_to_num(airpump_start_time_4), time_hr_min_to_num(airpump_end_time_4), time_hr_min_to_num(airpump_now_time));

    if (timer_airpump_no1 || timer_airpump_no2 || timer_airpump_no3 || timer_airpump_no4) {
      console.log("🧊 Air Pump : Timer ON");
      if (result_airpump == false) {
        client.publish("web/control/airpump", "ON");
        sw_airpump_json.set("value", true);
        sw_airpump_json.save();
        console.log("🧊 Air Pump : Write JSON Timer value -> true");
      }
    }
    else {
      console.log("🧊 Air Pump : Timer OFF");
      if (result_airpump == true) {
        client.publish("web/control/airpump", "OFF");
        sw_airpump_json.set("value", false);
        sw_airpump_json.save();
        console.log("🧊 Air Pump : Write JSON Timer value -> false");
      }
    }
  }
  else if (!timer_airpump) {
    console.log("🧊 Air Pump : Manual OFF");
    if (result_airpump == true) {
      client.publish("web/control/airpump", "OFF");
      sw_airpump_json.set("value", false);
      sw_airpump_json.save();
      console.log("🧊 Air Pump: Write JSON value : false");
    }
  }
  console.log("⏰ Update Time : " + hour + ":" + minute);
  console.log("<------------------------------------->");
}


// ---------------------------------------------- MQTT Subscribe ----------------------------------------------
// Connect MQTT
var client = mqtt.connect({
  host: MQTT_SERVER,
  port: MQTT_PORT,
  username: MQTT_USER,
  password: MQTT_PASSWORD
});

client.on('connect', function () {
  // Subscribe any topic
  console.log("MQTT Connect 🦟 ");
  client.subscribe('esp32/#', function (err) {
    if (err) {
      console.log(err);
    }
  });

});

var temp_db, hum_db, ec_ppm_db, ec_mscm_db, water_temp_db, water_level_db, light_db, ph_db = 0;

// Receive Message and print on terminal
client.on('message', function (topic, message) {
  try {
    var esp32_obj = JSON.parse(message);
    if(topic === "esp32/sensors") {
      console.log("[Topic 📧 => " + topic + "] [Date =>"+ message)+"]";
      temp_db = Number(esp32_obj.temp);
      hum_db = Number(esp32_obj.hum);
      ec_ppm_db = Number(esp32_obj.ec) * 500 / 1000;
      ec_mscm_db = Number(esp32_obj.ec) / 1000;
      ph_db = Number(esp32_obj.ph);
      water_temp_db = Number(esp32_obj.watertemp);
      water_level_db = ultrasonic_mm_percent(esp32_obj.ultrasonic);
      light_db = 1200;
    }

    else {
      console.log("[Topic => " + topic + "] [Date =>"+ message)+"]";
    }
    


    io.sockets.emit(
      "Update_Realtime_charts",
      { temp_data: esp32_obj.temp },
      { hum_data: esp32_obj.hum },
      { ec_data: esp32_obj.ec },
      { ph_data: esp32_obj.ph }
    );

    io.sockets.emit("tempdata", { value: esp32_obj.temp + "  °C" });
    io.sockets.emit("humdata", { value: esp32_obj.hum + " %" });
    io.sockets.emit("ecdata", { value: ((Number(esp32_obj.ec)) / 1000).toFixed(2) + " mS/cm" });
    io.sockets.emit("phdata", { value: esp32_obj.ph.toFixed(1) });
    io.sockets.emit("water_lvl", { value: ultrasonic_mm_percent(esp32_obj.ultrasonic) + " %" });
    io.sockets.emit("lightdata", { value: esp32_obj.watertemp.toFixed(1) + "  °C" });

  } catch (error) {
    // console.log(error);
    console.log("ESP32 Read Sensors ERROR !");
  }

});

function ultrasonic_mm_percent(mm) {
  if(mm <= 40) {
    return 100
  }

  else if(mm>=130){
    return 0
  }

  else return(140 - mm)
}












http.listen(PORT, () => {
  console.log(`HydroPlant app listening at http://localhost:` + PORT);
});
