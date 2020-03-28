
describe('DeeplyNestedNotifyPropertyChangedFixture', () => {
{
    it('NotifiesInitialValue_WithFallback', () => {
    var instance = new ClassA {Child = new ClassB {Age = 10}};

    //provide a fallback so a value can always be obtained
    var chain = instance.WhenChanged(a => a.Child.Age, (sender, a) => a, () => -1);

    int? result = null;

    var subscription = chain.Subscribe(age => result = age);

    expect(result).toBe(10)

    instance.Child.Age = 22;
    expect(result).toBe(22)

    instance.Child = new ClassB {Age = 25};
    expect(result).toBe(25)

    instance.Child.Age = 26;
    expect(result).toBe(26)
    instance.Child = null;
    expect(result).toBe(-1)

    instance.Child = new ClassB { Age = 21 };
    expect(result).toBe(21)
}

    it('NotifiesInitialValueAndNullChild', () => {
    var instance = new ClassA();

    var chain = instance.WhenPropertyChanged(a => a.Child.Age, true);
    int? result = null;

    var subscription = chain.Subscribe(notification => result = notification?.Value);
    expect(result).toBe(null)
    instance.Child = new ClassB { Age = 10 };

    expect(result).toBe(10)

    instance.Child.Age = 22;
    expect(result).toBe(22)

    instance.Child = new ClassB { Age = 25 };
    expect(result).toBe(25)

    instance.Child.Age = 26;
    expect(result).toBe(26)
    instance.Child = null;

}

    it('WithoutInitialValue', () => {
    var instance = new ClassA {Name="TestClass", Child = new ClassB {Age = 10}};

    var chain = instance.WhenPropertyChanged(a => a.Child.Age, false);
    int? result = null;

    var subscription = chain.Subscribe(notification => result = notification.Value);

    expect(result).toBe(null)

    instance.Child.Age = 22;
    expect(result).toBe(22)

    instance.Child = new ClassB {Age = 25};
    expect(result).toBe(25)
    instance.Child.Age = 30;
    expect(result).toBe(30)
}

    it('NullChildWithoutInitialValue', () => {
    var instance = new ClassA();

    var chain = instance.WhenPropertyChanged(a => a.Child.Age, false);
    int? result = null;

    var subscription = chain.Subscribe(notification => result = notification.Value);

    expect(result).toBe(null)

    instance.Child = new ClassB { Age = 21 };
    expect(result).toBe(21)

    instance.Child.Age = 22;
    expect(result).toBe(22)

    instance.Child = new ClassB { Age = 25 };
    expect(result).toBe(25)

    instance.Child.Age = 30;
    expect(result).toBe(30)
}

    it('NullChildWithInitialValue', () => {
    var instance = new ClassA();

    var chain = instance.WhenPropertyChanged(a => a.Child.Age, true);
    int? result = null;

    var subscription = chain.Subscribe(notification => result = notification?.Value);

    expect(result).toBe(null)

    instance.Child = new ClassB { Age = 21 };
    expect(result).toBe(21)

    instance.Child.Age = 22;
    expect(result).toBe(22)

    instance.Child = new ClassB { Age = 25 };
    expect(result).toBe(25)

    instance.Child.Age = 30;
    expect(result).toBe(30)
}

    it('DepthOfOne', () => {
    var instance = new ClassA {Name="Someone"};

    var chain = instance.WhenPropertyChanged(a => a.Name, true);
    string result = null;

    var subscription = chain.Subscribe(notification => result = notification?.Value);

    expect(result).toBe("Someone")

    instance.Name = "Else";
    expect(result).toBe("Else")

    instance.Name = null;
    expect(result).toBe(null)

    instance.Name = "NotNull";
    expect(result).toBe("NotNull")

}

    //  [Fact]
    //  [Trait("Manual run for benchmarking","xx")]
    private void StressIt()
{
    var list = new SourceList<ClassA>();
    var items = Enumerable.Range(1, 10_000)
        .Select(i => new ClassA { Name = i.ToString(), Child = new ClassB { Age = i } })
.ToArray();

    list.AddRange(items);

    var sw = new Stopwatch();

    //  var factory =

    var myObservable = list.Connect()
        .Do(_ => sw.Start())
        .WhenPropertyChanged(a => a.Child.Age, false)
        .Do(_ => sw.Stop())
        .Subscribe();

    items[1].Child.Age=-1;
    Console.WriteLine($"{sw.ElapsedMilliseconds}");
}

    public class ClassA: AbstractNotifyPropertyChanged, IEquatable<ClassA>
{
private string _name;

public string Name
    {
        get => _name;
        set => SetAndRaise(ref _name, value);
    }

private ClassB _classB;

public ClassB Child
    {
        get => _classB;
        set => SetAndRaise(ref _classB, value);
    }

    #region Equality

public bool Equals(ClassA other)
    {
        if (ReferenceEquals(null, other))
        {
            return false;
        }

        if (ReferenceEquals(this, other))
        {
            return true;
        }

        return string.Equals(_name, other._name) && Equals(_classB, other._classB);
    }

public override bool Equals(object obj)
    {
        if (ReferenceEquals(null, obj))
        {
            return false;
        }

        if (ReferenceEquals(this, obj))
        {
            return true;
        }

        if (obj.GetType() != GetType())
        {
            return false;
        }

        return Equals((ClassA) obj);
    }

public override int GetHashCode()
    {
        unchecked
        {
            return ((_name != null ? _name.GetHashCode() : 0) * 397) ^ (_classB != null ? _classB.GetHashCode() : 0);
        }
    }

    /// <summary>Returns a value that indicates whether the values of two <see cref="T:DynamicData.Tests.Binding.DeeplyNestedNotifyPropertyChangedFixture: IDisposable.ClassA" /> objects are equal.</summary>
    /// <param name="left">The first value to compare.</param>
    /// <param name="right">The second value to compare.</param>
    /// <returns>true if the <paramref name="left" /> and <paramref name="right" /> parameters have the same value; otherwise, false.</returns>
public static bool operator ==(ClassA left, ClassA right)
    {
        return Equals(left, right);
    }

    /// <summary>Returns a value that indicates whether two <see cref="T:DynamicData.Tests.Binding.DeeplyNestedNotifyPropertyChangedFixture: IDisposable.ClassA" /> objects have different values.</summary>
    /// <param name="left">The first value to compare.</param>
    /// <param name="right">The second value to compare.</param>
    /// <returns>true if <paramref name="left" /> and <paramref name="right" /> are not equal; otherwise, false.</returns>
public static bool operator !=(ClassA left, ClassA right)
    {
        return !Equals(left, right);
    }

    #endregion

public override string ToString()
    {
        return $"ClassA: Name={Name}, {nameof(Child)}: {Child}";
    }
}

    public class ClassB : AbstractNotifyPropertyChanged, IEquatable<ClassB>
{
private int _age;

public int Age
    {
        get => _age;
        set => SetAndRaise(ref _age, value);
    }

    #region Equality

public bool Equals(ClassB other)
    {
        if (ReferenceEquals(null, other))
        {
            return false;
        }

        if (ReferenceEquals(this, other))
        {
            return true;
        }

        return _age == other._age;
    }

public override bool Equals(object obj)
    {
        if (ReferenceEquals(null, obj))
        {
            return false;
        }

        if (ReferenceEquals(this, obj))
        {
            return true;
        }

        if (obj.GetType() != GetType())
        {
            return false;
        }

        return Equals((ClassB) obj);
    }

public override int GetHashCode()
    {
        return _age;
    }

    /// <summary>Returns a value that indicates whether the values of two <see cref="T:DynamicData.Tests.Binding.DeeplyNestedNotifyPropertyChangedFixture: IDisposable.ClassB" /> objects are equal.</summary>
    /// <param name="left">The first value to compare.</param>
    /// <param name="right">The second value to compare.</param>
    /// <returns>true if the <paramref name="left" /> and <paramref name="right" /> parameters have the same value; otherwise, false.</returns>
public static bool operator ==(ClassB left, ClassB right)
    {
        return Equals(left, right);
    }

    /// <summary>Returns a value that indicates whether two <see cref="T:DynamicData.Tests.Binding.DeeplyNestedNotifyPropertyChangedFixture: IDisposable.ClassB" /> objects have different values.</summary>
    /// <param name="left">The first value to compare.</param>
    /// <param name="right">The second value to compare.</param>
    /// <returns>true if <paramref name="left" /> and <paramref name="right" /> are not equal; otherwise, false.</returns>
public static bool operator !=(ClassB left, ClassB right)
    {
        return !Equals(left, right);
    }

    #endregion

public override string ToString()
    {
        return $"{nameof(Age)}: {Age}";
    }
}

}