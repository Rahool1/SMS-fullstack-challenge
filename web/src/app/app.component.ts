import { Component, OnInit } from '@angular/core';
import { CityService } from 'src/app/services/city.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  
  public startDate: string;
  public endDate: string;

  columnDefs = [
      {headerName: '', field: '', headerCheckboxSelection: true,
      headerCheckboxSelectionFilteredOnly: true,
      checkboxSelection: true,sort: 'asc', width: 30,  },
      {headerName: 'City', field: 'city',sortable: true,filter: true, sort: 'asc'},
      {headerName: 'Start Date', field: 'start_date',sortable: true,filter: true },
      {headerName: 'End Date', field: 'end_date',sortable: true,filter: true },
      {headerName: 'Price', field: 'price',sortable: true,filter: true },
      {headerName: 'Status', field: 'status',sortable: true,filter: true },
      {headerName: 'Colour', field: 'color',sortable: true,filter: true },
  ];
  defaultColDef = { resizable: true };
  cityData = [];

  
  constructor(public cityService: CityService) {}

  ngOnInit() {
    this.cityService.getCities().subscribe((res: any) => {
      this.cityData = res.data;
    });
  }

  filter() {
    console.log(this.startDate)
    console.log(this.endDate)
    console.log('filter');
  }

}
