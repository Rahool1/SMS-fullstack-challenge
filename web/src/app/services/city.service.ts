import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class CityService {
  url = environment.apiUrl;
  
  constructor(private http: HttpClient) { }

  getCities() {
    return this.http.get(this.url + 'cities').pipe(map((res: Response) => res));
  }
}
