import { Component } from '@angular/core';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  title = 'SMS-fullstack-challenge';

  columnDefs = [
      {headerName: '', field: 'id', headerCheckboxSelection: true,
      headerCheckboxSelectionFilteredOnly: true,
      checkboxSelection: true },
      {headerName: 'Make', field: 'make',sortable: true,filter: true},
      {headerName: 'Model', field: 'model',sortable: true,filter: true },
      {headerName: 'Price', field: 'price'}
  ];

  rowData = [
      { id:'', make: 'Toyota', model: 'Celica', price: 35000, },
      { id:'', make: 'Ford', model: 'Mondeo', price: 32000 },
      { id:'', make: 'Porsche', model: 'Boxter', price: 72000 }
  ];
    
  filter() {
    console.log('filter');
  }

}
