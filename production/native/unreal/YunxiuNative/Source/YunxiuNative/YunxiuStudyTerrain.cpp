#include "YunxiuStudyTerrain.h"
#include <limits>
#include "ProceduralMeshComponent.h"
#include "Misc/FileHelper.h"
#include "Misc/Paths.h"

AYunxiuStudyTerrain::AYunxiuStudyTerrain()
{
    PrimaryActorTick.bCanEverTick = false;
    Mesh = CreateDefaultSubobject<UProceduralMeshComponent>(TEXT("FrozenMapReference"));
    SetRootComponent(Mesh);
    Mesh->bUseAsyncCooking = false; // Collision must exist before placing the test pawn.
    Mesh->bUseComplexAsSimpleCollision = true;
}
void AYunxiuStudyTerrain::BeginPlay()
{
    Super::BeginPlay();
    BuildReferenceTerrain();
}
bool AYunxiuStudyTerrain::BuildReferenceTerrain()
{
    TArray<uint8> Bytes;
    const FString File = FPaths::ProjectContentDir() / TEXT("NativeSource/study-context.f32");
    if (!FFileHelper::LoadFileToArray(Bytes, *File) || Bytes.Num() != Columns * Rows * sizeof(float))
    {
        UE_LOG(LogTemp, Error, TEXT("Yunxiu source grid missing or invalid: %s"), *File);
        return false;
    }
    Heights.SetNumUninitialized(Columns * Rows);
    FMemory::Memcpy(Heights.GetData(), Bytes.GetData(), Bytes.Num());
    TArray<FVector> Vertices, Normals;
    TArray<int32> Triangles;
    TArray<FVector2D> UV;
    TArray<FLinearColor> Colors;
    TArray<FProcMeshTangent> Tangents;
    for (int32 Y=0; Y<Rows; ++Y)
    for (int32 X=0; X<Columns; ++X)
    {
        const float H = Heights[Y*Columns+X];
        if (!FMath::IsFinite(H)) return false;
        // Local study origin = east 1150m, south -3200m; base altitude 1700m.
        Vertices.Add(FVector((X*Spacing-500)*100, (Y*Spacing-500)*100, (H-1700)*100));
        Normals.Add(FVector::ZeroVector);
        UV.Add(FVector2D(X/20.0, Y/20.0));
    }
    auto AddTriangle = [&](int32 A, int32 B, int32 C)
    {
        Triangles.Append({A,B,C});
        const FVector N = FVector::CrossProduct(Vertices[B]-Vertices[A], Vertices[C]-Vertices[A]);
        Normals[A] += N; Normals[B] += N; Normals[C] += N;
    };
    for (int32 Y=0; Y<Rows-1; ++Y)
    for (int32 X=0; X<Columns-1; ++X)
    {
        const int32 A=Y*Columns+X;
        AddTriangle(A,A+1,A+Columns);
        AddTriangle(A+1,A+Columns+1,A+Columns);
    }
    for (FVector& N:Normals) N.Normalize();
    Mesh->CreateMeshSection_LinearColor(0,Vertices,Triangles,Normals,UV,Colors,Tangents,true);
    Mesh->SetCollisionEnabled(ECollisionEnabled::QueryAndPhysics);
    #if WITH_EDITOR
    SetActorLabel(TEXT("Yunxiu_Context_1597_REFERENCE"));
    #endif
    return true;
}
double AYunxiuStudyTerrain::HeightAtLocalMetres(double East, double South) const
{
    if (Heights.Num()!=Columns*Rows || East < -500 || East > 500 || South < -500 || South > 500)
        return std::numeric_limits<double>::quiet_NaN();
    const double GX=(East+500)/Spacing, GY=(South+500)/Spacing;
    const int32 X=FMath::Min(FMath::FloorToInt(GX),Columns-2), Y=FMath::Min(FMath::FloorToInt(GY),Rows-2);
    const double U=GX-X, V=GY-Y;
    const double A=Heights[Y*Columns+X], B=Heights[Y*Columns+X+1];
    const double C=Heights[(Y+1)*Columns+X], D=Heights[(Y+1)*Columns+X+1];
    const double H=U+V<=1 ? A*(1-U-V)+B*U+C*V : B*(1-V)+C*(1-U)+D*(U+V-1);
    return H-1700;
}
