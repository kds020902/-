#include <stdio.h>

int main(void){
    double radius;
    double area;

    printf("원의 면적을 입력하시요.");
    scanf("%lf", &radius);

    area = 3.141592 * radius * radius;
    printf("원의 면적 : %f \n", area);

    return 0;
}