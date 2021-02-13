plant_form_data="2021-01-18"
plant_date = plant_form_data.split("-");
var date_now = new Date();
var year = date_now.getFullYear();
var month = date_now.getMonth() + 1;
var days = date_now.getDate();

compare_date_now = year * 1000 + month * 100 + days;
compare_date_form = Number(plant_date[0]) * 1000 + Number(plant_date[1]) * 100 + Number(plant_date[2]);

console.log(compare_date_form+"---------"+compare_date_now);
if(compare_date_form>compare_date_now)
{
    console.log("Invalid 😪");
}
else{
    console.log("Valid 😍");
}