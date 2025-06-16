#include <stdio.h>

int main(void){
    double AA;
    double Bb;
    double Cc;
    int time;

    printf("배터리의 현재 용량을 입력해 주세요");
    scanf("%lf", &AA); // 0.1 ~ 45.00까지 입력 가능함함

    printf("휴대폰 사용시간을 확인해 주세요");
    scanf("%d", &time); //1 ~ 12만 입력 가능함함

    Cc = time * 0.8;

    Bb = AA - Cc;
    printf("현재 잔존 배터리 양 : %f\n", Bb);

    if(Bb < 25){
        printf("잔존 배러리 양은 %lf 입니다! 충전을 권고드립니다.", Bb);
    } else {
    printf("배터리 상태 양호 (%.1f%%)\n", Bb);
    }
    
    return 0;

    
}