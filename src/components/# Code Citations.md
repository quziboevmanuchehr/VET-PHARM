# Code Citations

## License: unknown
https://github.com/ahixon/atlassian-frontend-mirror/tree/56aed9b2a0dfb8052ad71fe1668a04342db3de30/media/media-common/src/utils/helpers.ts

```
wait: number) => {
    let timeout: NodeJS.Timeout;
    return (...args: any[]) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  }
```


## License: unknown
https://github.com/EdimarioJr/cinebusca/tree/a3db44da715a5419e69dfcca026d99a2fab6908d/src/utils/debounce.ts

```
debounce = (func: Function, wait: number) => {
    let timeout: NodeJS.Timeout;
    return (...args: any[]) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args)
```


## License: unknown
https://github.com/Tamagochi02/web_modular3/tree/81815d93f6c3d9426eb45b971c0937bb77a3d99d/pages/pdf/%5Bid%5D/resumen.jsx

```
= 210;
      const pageHeight = 297;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;
      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -=
```

