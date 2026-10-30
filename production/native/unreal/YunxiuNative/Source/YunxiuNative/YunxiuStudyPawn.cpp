#include "YunxiuStudyPawn.h"
#include "Camera/CameraComponent.h"
#include "Components/InputComponent.h"
#include "Components/CapsuleComponent.h"
#include "GameFramework/CharacterMovementComponent.h"
AYunxiuStudyPawn::AYunxiuStudyPawn()
{
    GetCapsuleComponent()->InitCapsuleSize(30.f,87.5f);
    UCameraComponent* Camera=CreateDefaultSubobject<UCameraComponent>(TEXT("StudyCamera"));
    Camera->SetupAttachment(GetCapsuleComponent());
    Camera->SetRelativeLocation(FVector(0,0,70));
    Camera->bUsePawnControlRotation=true;
    bUseControllerRotationYaw=true;
    GetCharacterMovement()->MaxWalkSpeed=111.111f; // 4km/h diagnostic baseline, not final speed tuning.
}
void AYunxiuStudyPawn::SetupPlayerInputComponent(UInputComponent* Input)
{
    Super::SetupPlayerInputComponent(Input);
    Input->BindAxis(TEXT("Forward"),this,&AYunxiuStudyPawn::Forward);
    Input->BindAxis(TEXT("Right"),this,&AYunxiuStudyPawn::Right);
    Input->BindAxis(TEXT("Turn"),this,&AYunxiuStudyPawn::Turn);
    Input->BindAxis(TEXT("Look"),this,&AYunxiuStudyPawn::Look);
    Input->BindAction(TEXT("Jump"),IE_Pressed,this,&ACharacter::Jump);
    Input->BindAction(TEXT("Jump"),IE_Released,this,&ACharacter::StopJumping);
}
void AYunxiuStudyPawn::Forward(float V){AddMovementInput(GetActorForwardVector(),V);}
void AYunxiuStudyPawn::Right(float V){AddMovementInput(GetActorRightVector(),V);}
void AYunxiuStudyPawn::Turn(float V){AddControllerYawInput(V);}
void AYunxiuStudyPawn::Look(float V){AddControllerPitchInput(V);}
